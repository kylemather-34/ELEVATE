import * as vscode from "vscode";
import { HttpServer } from "./HTTPServer";
import { Router } from "./Router";
import { JobQueue } from "./JobQueue";
import { JobStore } from "./JobStore";
import { SseHub } from "./SSEHub";
import { OllamaClient } from "./OllamaClient";
import { ChatMessage, CreateChatJobRequest, HealthResponse, JobEvent, JobRecord, JobStatus, ModelsResponse } from "./types";
import { Pipeline } from "../pipeline/Pipeline";
import { ParseStage, PromptBuilderStage, OllamaStage } from "../pipeline/Stage";
import { Logger } from "../util/Logger";
import { ElevateContext } from "./ElevateContext";
import { OllamaProcess } from "./OllamaProcess";
import * as path from "path";

export class ElevateCore {
  private server: HttpServer | null = null;
  private hub = new SseHub();
  private store: JobStore;
  private queue: JobQueue;
  private ollama: OllamaClient;
  private ollamaProcess: OllamaProcess;
  private logger: Logger;
  private pipeline: Pipeline;
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {
    this.store = new JobStore(context);

    const cfg = vscode.workspace.getConfiguration("elevate");
    const ollamaUrl = cfg.get<string>("ollamaUrl") ?? "http://localhost:11434";
    const concurrency = cfg.get<number>("concurrency") ?? 1;

    this.ollama = new OllamaClient(ollamaUrl);
    this.ollamaProcess = new OllamaProcess(ollamaUrl, output);
    const ext = process.platform === "win32" ? ".exe" : "";
    const root = context.extensionUri.fsPath;
    // Packaged extension: binaries are in bin/ at the extension root.
    // Dev: binaries are in cpp_native/build/bin/ after a local CMake build.
    const parserBin = require("fs").existsSync(path.join(root, "bin", `parser${ext}`))
      ? path.join(root, "bin", `parser${ext}`)
      : path.join(root, "cpp_native", "build", "bin", `parser${ext}`);
    const promptBuilderBin = require("fs").existsSync(path.join(root, "bin", `prompt_builder${ext}`))
      ? path.join(root, "bin", `prompt_builder${ext}`)
      : path.join(root, "cpp_native", "build", "bin", `prompt_builder${ext}`);

    this.logger = new Logger(output);
    this.pipeline = new Pipeline(
      [
        new ParseStage(parserBin),
        new PromptBuilderStage(promptBuilderBin),
        new OllamaStage(this.ollama),
      ],
      this.logger
    );

    this.queue = new JobQueue(this.store, this.hub, this.ollama, { concurrency }, async (payload, _signal) => {
      const ctx = new ElevateContext(payload.fileText);
      ctx.analysisTarget = payload.fileText;
      ctx.cursorLine = payload.cursorLine;
      await this.pipeline.execute(ctx);
      return {
        modelResponse: ctx.modelResponse ?? "",
        analysisResult: ctx.analysisResult,
        ollamaMetrics: ctx.ollamaMetrics,
      };
    });

    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("elevate");

    // keep file versions on updated save
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const key = this.getFileKey(doc);
      this.queue.setFileVersion(key, doc.version);
    });

    // optional, tracks live edits
    vscode.workspace.onDidChangeTextDocument((e) => {
      const key = this.getFileKey(e.document);
      this.queue.setFileVersion(key, e.document.version);
    });

    // clear diagnostics when a file is closed
    vscode.workspace.onDidCloseTextDocument((doc) => {
      this.diagnosticCollection.delete(doc.uri);
    });
  }

  // unique key per file
  private getFileKey(doc: vscode.TextDocument): string {
    return doc.uri.toString();
  }

  async start(): Promise<void> {
    // start ollama, then queue
    await this.ollamaProcess.start();
    await this.queue.start();

    // start HTTP server
    const cfg = vscode.workspace.getConfiguration("elevate");
    const port = cfg.get<number>("backendPort") ?? 34345;

    const router = new Router();

    router.add("GET", "/health", async (_req, res) => {
      HttpServer.json(res, 200, { ok: true, ollama_url: (vscode.workspace.getConfiguration("elevate").get("ollamaUrl") ?? "http://localhost:11434") } satisfies HealthResponse);
    });

    router.add("GET", "/v1/models", async (_req, res) => {
      try {
        const [tags, ps] = await Promise.all([this.ollama.tags(), this.ollama.ps()]);
        const out: ModelsResponse = { tags, ps };
        HttpServer.json(res, 200, out);
      } catch (e: any) {
        HttpServer.json(res, 502, { error: "ollama_unreachable", message: String(e?.message ?? e) });
      }
    });

    router.add("GET", "/v1/jobs", async (_req, res, ctx) => {
      const limit = Number(ctx.query["limit"] ?? "50");
      const jobs = await this.queue.listJobs(limit);
      HttpServer.json(res, 200, { jobs });
    });

    router.add("GET", "/v1/jobs/:id", async (_req, res, ctx) => {
      const job = await this.queue.getJob(ctx.params.id);
      if (!job) return HttpServer.json(res, 404, { error: "not_found" });
      HttpServer.json(res, 200, job);
    });

    router.add("POST", "/v1/jobs", async (_req, res, ctx) => {
      const body = await ctx.bodyJson<CreateChatJobRequest>();
      if (!body || body.type !== "OLLAMA_CHAT") {
        return HttpServer.json(res, 400, { error: "bad_request", message: "Only OLLAMA_CHAT supported in MVP" });
      }

      // get active document
      const activeEditor = vscode.window.activeTextEditor;
      const doc = activeEditor?.document;

      const fileKey = doc ? this.getFileKey(doc) : body.payload?.analysis_key;
      const version = doc?.version ?? body.version ?? 0;

      // update latest version in queue
      if (fileKey) {
        this.queue.setFileVersion(fileKey, version);
      }

      const job = await this.queue.enqueueChatJob({
        priority: body.priority ?? 5,
        model: body.model,
        messages: body.payload?.messages ?? [],
        keep_alive: body.keep_alive ?? "5m",
        options: body.options ?? {},
        analysis_key: fileKey,
        version: version
      });

      HttpServer.json(res, 202, { job_id: job.job_id, status: job.status, created_at: job.created_at });
    });

    router.add("POST", "/v1/jobs/:id/cancel", async (_req, res, ctx) => {
      const result = await this.queue.cancelJob(ctx.params.id);
      HttpServer.json(res, 200, result);
    });

    router.add("POST", "/v1/prompt", async (_req, res, ctx) => {
      const body = await ctx.bodyJson<{ parsed: any; text?: string }>();

      if (!body?.parsed) {
        return HttpServer.json(res, 400, {
          error: "bad_request",
          message: "Request body must include a 'parsed' field",
        });
      }

      const elevateCtx = new ElevateContext(body.text ?? "");
      elevateCtx.parsed = body.parsed;
      elevateCtx.analysisTarget = body.text ?? "";

      const _ext = process.platform === "win32" ? ".exe" : "";
      const _root = this.context.extensionUri.fsPath;
      const promptBuilderBin = require("fs").existsSync(path.join(_root, "bin", `prompt_builder${_ext}`))
        ? path.join(_root, "bin", `prompt_builder${_ext}`)
        : path.join(_root, "cpp_native", "build", "bin", `prompt_builder${_ext}`);

      try {
        await new PromptBuilderStage(promptBuilderBin).run(elevateCtx, this.logger);
        await new OllamaStage(this.ollama).run(elevateCtx, this.logger);
      } catch (e: any) {
        return HttpServer.json(res, 500, {
          error: "pipeline_error",
          message: String(e?.message ?? e),
        });
      }

      HttpServer.json(res, 200, {
        response: elevateCtx.modelResponse,
      });
    });

    router.add("GET", "/v1/stats", async (_req, res) => {
      const all = await this.store.loadAll();
      const done = all.filter(j => j.status === "succeeded" && j.started_at && j.finished_at);

      const percentile = (arr: number[], p: number) => {
        if (!arr.length) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
        return Math.round(sorted[idx]);
      };

      const queueWaits = done.map(j => new Date(j.started_at!).getTime() - new Date(j.created_at).getTime());
      const totalDurations = done.map(j => new Date(j.finished_at!).getTime() - new Date(j.started_at!).getTime());
      const inferenceMs = done.filter(j => j.metrics?.eval_duration).map(j => Math.round(j.metrics!.eval_duration / 1e6));
      const tokensPerSec = done.filter(j => j.metrics?.eval_count && j.metrics?.eval_duration).map(j => Math.round(j.metrics!.eval_count / (j.metrics!.eval_duration / 1e9)));
      const promptTokens = done.filter(j => j.metrics?.prompt_eval_count).map(j => j.metrics!.prompt_eval_count as number);
      const completionTokens = done.filter(j => j.metrics?.eval_count).map(j => j.metrics!.eval_count as number);

      const agg = (arr: number[]) => arr.length === 0 ? null : {
        count: arr.length,
        avg: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
        min: Math.min(...arr),
        max: Math.max(...arr),
        p50: percentile(arr, 50),
        p95: percentile(arr, 95),
      };

      const jobs = done.map(j => ({
        job_id: j.job_id,
        model: j.model,
        queue_wait_ms: new Date(j.started_at!).getTime() - new Date(j.created_at).getTime(),
        total_duration_ms: new Date(j.finished_at!).getTime() - new Date(j.started_at!).getTime(),
        inference_ms: j.metrics?.eval_duration ? Math.round(j.metrics.eval_duration / 1e6) : null,
        prompt_tokens: j.metrics?.prompt_eval_count ?? null,
        completion_tokens: j.metrics?.eval_count ?? null,
        tokens_per_sec: (j.metrics?.eval_count && j.metrics?.eval_duration) ? Math.round(j.metrics.eval_count / (j.metrics.eval_duration / 1e9)) : null,
      }));

      HttpServer.json(res, 200, {
        total_jobs: all.length,
        succeeded_jobs: done.length,
        canceled_jobs: all.filter(j => j.status === "canceled").length,
        failed_jobs: all.filter(j => j.status === "failed").length,
        queue_wait_ms: agg(queueWaits),
        total_duration_ms: agg(totalDurations),
        inference_ms: agg(inferenceMs),
        tokens_per_sec: agg(tokensPerSec),
        total_prompt_tokens: promptTokens.reduce((s, v) => s + v, 0),
        total_completion_tokens: completionTokens.reduce((s, v) => s + v, 0),
        jobs,
      });
    });

    // SSE events: /v1/jobs/:id/events?after=0
    router.add("GET", "/v1/jobs/:id/events", async (req, res, ctx) => {
      const jobId = ctx.params.id;
      const after = Number(ctx.query["after"] ?? "0");

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const writeEvt = (event: string, data: any) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send history first
      const hist = this.hub.getHistory(jobId, after);
      let idx = after;
      for (const e of hist) {
        writeEvt("job_event", { index: idx++, ...e });
      }

      // keep-alive ping
      const ping = setInterval(() => writeEvt("ping", {}), 15000);

      const unsub = this.hub.subscribe(jobId, (e) => {
        writeEvt("job_event", { index: idx++, ...e });
      });

      req.on("close", () => {
        clearInterval(ping);
        unsub();
        res.end();
      });
    });

    this.server = new HttpServer(port, router);
    await this.server.listen("127.0.0.1");
    this.output.appendLine(`[ELEVATE] Backend HTTP server listening on 127.0.0.1:${port}`);
  }

  stop(): void {
    this.queue.stop();
    void this.server?.close();
    this.server = null;
    this.diagnosticCollection.dispose();
    this.ollamaProcess.stop();
  }

  async health(): Promise<HealthResponse> {
    const ollamaUrl = vscode.workspace.getConfiguration("elevate").get("ollamaUrl") as string ?? "http://localhost:11434";
    const ok = await this.checkOllama();
    return { ok, ollama_url: ollamaUrl };
  }

  async checkOllama(): Promise<boolean> {
    try {
      await this.ollama.tags();
      return true;
    } catch {
      return false;
    }
  }

  async enqueueChatJob(args: { priority: number; model: string; messages: ChatMessage[]; keep_alive?: string; options?: Record<string, any> }) {
    return this.queue.enqueueChatJob(args);
  }

  subscribeJob(jobId: string, fn: (evt: JobEvent) => void): () => void {
    return this.hub.subscribe(jobId, fn);
  }

  async listJobs(limit = 50): Promise<(JobRecord & { preview?: string })[]> {
    return this.queue.listJobs(limit) as any;
  }

  async cancelJob(jobId: string) {
    return this.queue.cancelJob(jobId);
  }

  getStore(): JobStore {
    return this.store;
  }

  async runPipeline(ctx: ElevateContext): Promise<void> {
    const fileText = ctx.analysisTarget ?? ctx.snapshot?.text ?? ctx.text ?? "";
    const fileUri = ctx.snapshot?.uri ?? "";
    const version = ctx.snapshot?.version ?? ctx.version ?? 0;

    const job = await this.queue.enqueuePipelineJob({
      fileText,
      fileUri,
      cursorLine: ctx.cursorLine,
      version,
      priority: 5,
    });

    const done = await this.waitForTerminalStatus(job.job_id);

    if (done.status === JobStatus.FAILED) {
      throw new Error(done.error ?? "Pipeline job failed");
    }

    if (done.status === JobStatus.SUCCEEDED) {
      ctx.modelResponse = done.result_text ?? undefined;
      ctx.analysisResult = done.analysis_result ?? undefined;
      ctx.ollamaMetrics = done.metrics ?? undefined;
    }

    if (!fileUri) { return; }

    const uri = vscode.Uri.parse(fileUri);
    const diagnostics = ctx.analysisResult
      ? ctx.analysisResult.issues.map(issue => new vscode.Diagnostic(
          new vscode.Range(issue.line - 1, 0, issue.line - 1, Number.MAX_SAFE_INTEGER),
          issue.description,
          resolveSeverity(issue.severity)
        ))
      : [];
    this.diagnosticCollection.set(uri, diagnostics);
    ctx.diagnostics = diagnostics;
  }

  waitForTerminalStatus(jobId: string): Promise<JobRecord> {
    const terminal = new Set([JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELED]);

    return new Promise((resolve, reject) => {
      let settled = false;
      let unsub: () => void;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        unsub?.();
        fn();
      };

      unsub = this.hub.subscribe(jobId, (evt) => {
        if (evt.event_type === "STATUS" && terminal.has(evt.payload.status)) {
          settle(() => {
            this.queue.getJob(jobId)
              .then((job) => job ? resolve(job) : reject(new Error(`Job not found: ${jobId}`)))
              .catch(reject);
          });
        }
      });

      // Resolve immediately if the job already reached a terminal state before we subscribed.
      this.queue.getJob(jobId)
        .then((job) => {
          if (!job) { settle(() => reject(new Error(`Job not found: ${jobId}`))); return; }
          if (terminal.has(job.status)) { settle(() => resolve(job)); }
        })
        .catch((err) => settle(() => reject(err)));
    });
  }
}

function resolveSeverity(severity: "error" | "warning" | "info"): vscode.DiagnosticSeverity {
  switch (severity) {
    case "error":   return vscode.DiagnosticSeverity.Error;
    case "warning": return vscode.DiagnosticSeverity.Warning;
    case "info":    return vscode.DiagnosticSeverity.Information;
  }
}
