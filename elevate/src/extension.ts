import * as vscode from "vscode";
import { ElevateCore } from "./backend/ElevateCore";
import { JobEvent, JobRecord, JobStatus } from "./backend/types";
import { CursorTracker } from "./extension/cursorTracker";
import { Logger } from "./util/Logger";
import { ExtensionController } from "./extension/ExtensionController";
import { loadSettings } from "./backend/StorageLayer";
import { CoreStateManager } from "./backend/CoreStateManager";

let backend: ElevateCore | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("ELEVATE");
  context.subscriptions.push(output);

  const logger = new Logger(output);
  output.appendLine("[ELEVATE] Activating...");

  backend = new ElevateCore(context, output);

  // Load persisted settings on activation
  const settings = loadSettings(context);
  output.appendLine("[ELEVATE Loaded Settings: " + JSON.stringify(settings));

  // Start backend on activation, but don't crash activation if it fails.
  try {
    await backend.start();
    output.appendLine("[ELEVATE] Backend started.");
  } catch (err: any) {
    output.appendLine(`[ELEVATE] Backend failed to start: ${err?.message ?? String(err)}`);
    vscode.window.showWarningMessage(
      "ELEVATE backend failed to start. Run \"ELEVATE: Backend Status\" for details."
    );
  }

  // Check if Ollama is reachable and warn the user if not.
  const ollamaReachable = await backend.checkOllama();
  if (!ollamaReachable) {
    output.appendLine("[ELEVATE] Ollama is not reachable.");
    const action = await vscode.window.showWarningMessage(
      "ELEVATE: Ollama is not running. Start it with `ollama serve`, or enable \"Launch at Login\" in the Ollama menu bar app.",
      "Open Ollama Docs"
    );
    if (action === "Open Ollama Docs") {
      vscode.env.openExternal(vscode.Uri.parse("https://ollama.com/download"));
    }
  }

  const stateManager = new CoreStateManager();
  stateManager.initialize();

  const controller = new ExtensionController(backend, logger);
  controller.activateStatusBar(context);
  controller.activateResponsePanel(context);
  controller.activateOpenFileListener(context);
  context.subscriptions.push(controller);

  // Wire SessionContext — track active file and accumulate feedback from each analysis run.
  controller.onAnalysisComplete((result) => {
    if (result.snapshot) {
      stateManager.getSession().setActiveFile(result.snapshot);
    }
    stateManager.getSession().addFeedback(result.modelResponse);
    stateManager.saveState(result.ctx);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.openResponsePanel", () => {
      controller.showResponsePanel();
    })
  );

  const cfg = vscode.workspace.getConfiguration("elevate");

  const cursorEnabled = cfg.get<boolean>("cursorTracking.enabled", true);
  const editEnabled = cfg.get<boolean>("editListener.enabled", true);

  const debounceMs = cfg.get<number>("editListener.debounceMs", 350);
  const maxWaitMs = cfg.get<number>("editListener.maxWaitMs", 2500);

  const fsWatcherEnabled = cfg.get<boolean>("fileWatcher.enabled", false);
  const fsWatcherGlob = cfg.get<string>("fileWatcher.glob", "**/*");

  const cursorTracker = new CursorTracker(logger, false);

  if (cursorEnabled) {
    cursorTracker.start();
    output.appendLine("[ELEVATE] Cursor tracking enabled.");
  } else {
    output.appendLine("[ELEVATE] Cursor tracking disabled by config.");
  }
  context.subscriptions.push(cursorTracker);

  if (editEnabled) {
    controller.activateSaveListener(context, { debounceMs, maxWaitMs, fsWatcherEnabled, fsWatcherGlob });
    output.appendLine(
      `[ELEVATE] Edit listener enabled (debounce=${debounceMs}ms, maxWait=${maxWaitMs}ms).`
    );
  } else {
    output.appendLine("[ELEVATE] Edit listener disabled by config.");
  }

  // Command: Show cursor position
  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.showCursorPosition", () => {
      const loc = cursorTracker.getCurrent();
      if (!loc) {
        vscode.window.showInformationMessage("ELEVATE: No active text editor.");
        return;
      }

      vscode.window.showInformationMessage(
        `ELEVATE cursor: ${loc.uri.fsPath || loc.uri.toString()} @ ${loc.line1}:${loc.character1} (carets=${loc.caretCount})`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.helloWorld", async () => {
      vscode.window.showInformationMessage("Hello from ELEVATE 👋");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.openBackendStatus", async () => {
      try {
        const status = backend ? await backend.health() : { ok: false };
        vscode.window.showInformationMessage(
          `ELEVATE backend: ${status.ok ? "OK" : "NOT RUNNING"}`
        );
      } catch (err: any) {
        vscode.window.showInformationMessage("ELEVATE backend: NOT RUNNING");
        output.appendLine(
          `[ELEVATE] Backend status check failed: ${err?.message ?? String(err)}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.runPrompt", async () => {
      if (!backend) return;

      const cfg = vscode.workspace.getConfiguration("elevate");
      const model = cfg.get<string>("defaultModel") ?? "llama3.1:latest";

      const prompt = await vscode.window.showInputBox({
        title: "ELEVATE (Ollama)",
        prompt: "Enter a prompt to send to Ollama",
        placeHolder: "e.g., Explain this error in one paragraph…",
      });
      if (!prompt) return;

      output.show(true);
      output.appendLine(`\n[ELEVATE] Enqueue job: model=${model}`);

      let job;
      try {
        job = await backend.enqueueChatJob({
          priority: 9,
          model,
          messages: [{ role: "user", content: prompt }],
          keep_alive: "5m",
          options: {},
        });
      } catch (err: any) {
        output.appendLine(`[ELEVATE] Failed to enqueue job: ${err?.message ?? String(err)}`);
        vscode.window.showErrorMessage("Failed to enqueue ELEVATE job (see Output: ELEVATE).");
        return;
      }

      output.appendLine(`[ELEVATE] Job created: ${job.job_id} (status=${job.status})`);
      output.appendLine(`[ELEVATE] Streaming output…`);

      // Stream events via in-process subscription (no HTTP needed for this UI)
      const unsub = backend.subscribeJob(job.job_id, (evt: JobEvent) => {
        if (evt.event_type === "OUTPUT_CHUNK") {
          output.append(evt.payload.delta ?? "");
        } else if (evt.event_type === "STATUS") {
          output.appendLine(`\n[ELEVATE] Status: ${evt.payload.status}`);
        } else if (evt.event_type === "ERROR") {
          output.appendLine(`\n[ELEVATE] Error: ${evt.payload.message ?? "unknown"}`);
        }
      });

      // Also show final state when done:
      let done;
      try {
        done = await backend.waitForTerminalStatus(job.job_id);
      } catch (err: any) {
        unsub();
        output.appendLine(
          `\n[ELEVATE] Failed while waiting for completion: ${err?.message ?? String(err)}`
        );
        vscode.window.showErrorMessage("ELEVATE job failed (see Output: ELEVATE).");
        return;
      }

      unsub();

      if (done.status === JobStatus.SUCCEEDED) {
        output.appendLine(`\n[ELEVATE] Done.`);
      } else if (done.status === JobStatus.CANCELED) {
        output.appendLine(`\n[ELEVATE] Canceled.`);
      } else {
        output.appendLine(`\n[ELEVATE] Failed: ${done.error ?? "unknown"}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.cancelJob", async () => {
      if (!backend) return;

      let jobs;
      try {
        jobs = await backend.listJobs(25);
      } catch (err: any) {
        output.appendLine(`[ELEVATE] Failed to list jobs: ${err?.message ?? String(err)}`);
        vscode.window.showErrorMessage("Failed to list jobs (see Output: ELEVATE).");
        return;
      }

      if (jobs.length === 0) {
        vscode.window.showInformationMessage("No jobs found.");
        return;
      }

      const items = jobs.map((j: JobRecord & { preview?: string }) => ({
        label: `${j.job_id}`,
        description: `${j.status} • ${j.model} • prio ${j.priority}`,
        detail: j.preview ?? "",
        jobId: j.job_id,
      }));
      const pick = await vscode.window.showQuickPick(items, { title: "Cancel which job?" });
      if (!pick) return;

      try {
        const res = await backend.cancelJob(pick.jobId);
        vscode.window.showInformationMessage(
          `Job ${res.job_id}: ${res.previous_status} → ${res.new_status}`
        );
      } catch (err: any) {
        output.appendLine(`[ELEVATE] Cancel failed: ${err?.message ?? String(err)}`);
        vscode.window.showErrorMessage("Failed to cancel job (see Output: ELEVATE).");
      }
    })
  );

  context.subscriptions.push({
    dispose: () => backend?.stop(),
  });

  output.appendLine("[ELEVATE] Activated.");
}

export function deactivate() {
  backend?.stop();
}