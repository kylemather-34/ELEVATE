import * as vscode from "vscode";
import { HttpServer } from "./HTTPServer";
import { Router } from "./Router";
import { JobQueue } from "./JobQueue";
import { JobStore } from "./JobStore";
import { SseHub } from "./SSEHub";
import { OllamaClient } from "./OllamaClient";
import { CreateChatJobRequest, HealthResponse, JobEvent, JobRecord, JobStatus, ModelsResponse } from "./types";
import { isoNow } from "../util/time";
import { Pipeline } from "../pipeline/Pipeline";
import { SanitizationStage, ParseStage, PromptBuilderStage, OllamaStage } from "../pipeline/Stage";
import { Logger } from "../Logger";
import { ElevateContext } from "./ElevateContext";
import * as path from "path";

export class ElevateCore {
  private server: HttpServer | null = null;
  private hub = new SseHub();
  private store: JobStore;
  private queue: JobQueue;
  private ollama: OllamaClient;
  private logger: Logger;
  private pipeline: Pipeline;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {
    this.store = new JobStore(context);

    const cfg = vscode.workspace.getConfiguration("elevate");
    const ollamaUrl = cfg.get<string>("ollamaUrl") ?? "http://localhost:11434";
    const concurrency = cfg.get<number>("concurrency") ?? 1;

    this.ollama = new OllamaClient(ollamaUrl);
    this.queue = new JobQueue(this.store, this.hub, this.ollama, { concurrency });

    const parserBin = path.join(context.extensionUri.fsPath, "cpp_native", "build", "bin", "parser");
    const promptBuilderBin = path.join(context.extensionUri.fsPath, "cpp_native", "build", "bin", "prompt_builder");

    this.logger = new Logger(output);
    this.pipeline = new Pipeline(
      [new SanitizationStage(), new ParseStage(parserBin), new PromptBuilderStage(promptBuilderBin), new OllamaStage(this.ollama)],
      this.logger
    );
  }

  async start(): Promise<void> {
    // start queue
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

      const job = await this.queue.enqueueChatJob({
        priority: body.priority ?? 5,
        model: body.model,
        messages: body.payload?.messages ?? [],
        keep_alive: body.keep_alive ?? "5m",
        options: body.options ?? {},
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

      const promptBuilderBin = path.join(this.context.extensionUri.fsPath, "cpp_native", "build", "bin", "prompt_builder");

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
  }

  async health(): Promise<HealthResponse> {
    return { ok: true, ollama_url: vscode.workspace.getConfiguration("elevate").get("ollamaUrl") ?? "http://localhost:11434" };
  }

  async enqueueChatJob(args: { priority: number; model: string; messages: any[]; keep_alive?: string; options?: any }) {
    return this.queue.enqueueChatJob(args as any);
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

  async runPipeline(ctx: ElevateContext): Promise<void> {
    return this.pipeline.execute(ctx);
  }

  async waitForTerminalStatus(jobId: string): Promise<JobRecord> {
    while (true) {
      const job = await this.queue.getJob(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);

      if ([JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.CANCELED].includes(job.status)) {
        return job;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}