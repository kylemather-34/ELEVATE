import * as vscode from "vscode";
import { ElevateCore } from "./backend/ElevateCore";
import { JobStatus } from "./backend/types";

let backend: ElevateCore | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("ELEVATE");
  output.appendLine("[ELEVATE] Activating…");

  backend = new ElevateCore(context, output);
  await backend.start(); // auto-start on activation

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.openBackendStatus", async () => {
      const status = backend ? await backend.health() : { ok: false };
      vscode.window.showInformationMessage(
        `ELEVATE backend: ${status.ok ? "OK" : "NOT RUNNING"}`
      );
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

      const job = await backend.enqueueChatJob({
        priority: 9,
        model,
        messages: [{ role: "user", content: prompt }],
        keep_alive: "5m",
        options: {},
      });

      output.appendLine(`[ELEVATE] Job created: ${job.job_id} (status=${job.status})`);
      output.appendLine(`[ELEVATE] Streaming output…`);

      // Stream events via in-process subscription (no HTTP needed for this UI)
      const unsub = backend.subscribeJob(job.job_id, (evt) => {
        if (evt.event_type === "OUTPUT_CHUNK") {
          output.append(evt.payload.delta ?? "");
        } else if (evt.event_type === "STATUS") {
          output.appendLine(`\n[ELEVATE] Status: ${evt.payload.status}`);
        } else if (evt.event_type === "ERROR") {
          output.appendLine(`\n[ELEVATE] Error: ${evt.payload.message ?? "unknown"}`);
        }
      });

      // Also show final state when done:
      const done = await backend.waitForTerminalStatus(job.job_id);
      unsub();

      if (done.status === JobStatus.SUCCEEDED) {
        output.appendLine(`\n[ELEVATE] ✅ Done.`);
      } else if (done.status === JobStatus.CANCELED) {
        output.appendLine(`\n[ELEVATE] 🛑 Canceled.`);
      } else {
        output.appendLine(`\n[ELEVATE] ❌ Failed: ${done.error ?? "unknown"}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("elevate.cancelJob", async () => {
      if (!backend) return;

      const jobs = await backend.listJobs(25);
      if (jobs.length === 0) {
        vscode.window.showInformationMessage("No jobs found.");
        return;
      }

      const pick = await vscode.window.showQuickPick(
        jobs.map((j) => ({
          label: `${j.job_id}`,
          description: `${j.status} • ${j.model} • prio ${j.priority}`,
          detail: j.preview ?? "",
          jobId: j.job_id,
        })),
        { title: "Cancel which job?" }
      );
      if (!pick) return;

      const res = await backend.cancelJob(pick.jobId);
      vscode.window.showInformationMessage(
        `Job ${res.job_id}: ${res.previous_status} → ${res.new_status}`
      );
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