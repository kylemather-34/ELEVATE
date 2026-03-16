"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElevateBackend = void 0;
const vscode = __importStar(require("vscode"));
const HTTPServer_1 = require("./HTTPServer");
const Router_1 = require("./Router");
const JobQueue_1 = require("./JobQueue");
const JobStore_1 = require("./JobStore");
const SSEHub_1 = require("./SSEHub");
const OllamaClient_1 = require("./OllamaClient");
const types_1 = require("./types");
const Pipeline_1 = require("../pipeline/Pipeline");
const Stage_1 = require("../pipeline/Stage");
const Logger_1 = require("../Logger");
const path = __importStar(require("path"));
class ElevateBackend {
    context;
    output;
    server = null;
    hub = new SSEHub_1.SseHub();
    store;
    queue;
    ollama;
    logger;
    pipeline;
    constructor(context, output) {
        this.context = context;
        this.output = output;
        this.store = new JobStore_1.JobStore(context);
        const cfg = vscode.workspace.getConfiguration("elevate");
        const ollamaUrl = cfg.get("ollamaUrl") ?? "http://localhost:11434";
        const concurrency = cfg.get("concurrency") ?? 1;
        this.ollama = new OllamaClient_1.OllamaClient(ollamaUrl);
        this.queue = new JobQueue_1.JobQueue(this.store, this.hub, this.ollama, { concurrency });
        const parserBin = path.join(context.extensionUri.fsPath, "cpp_native", "build", "bin", "parser");
        this.logger = new Logger_1.Logger();
        this.pipeline = new Pipeline_1.Pipeline([new Stage_1.SanitizationStage(), new Stage_1.ParseStage(parserBin), new Stage_1.PromptBuilderStage(), new Stage_1.OllamaStage()], this.logger);
    }
    async start() {
        // start queue
        await this.queue.start();
        // start HTTP server
        const cfg = vscode.workspace.getConfiguration("elevate");
        const port = cfg.get("backendPort") ?? 34345;
        const router = new Router_1.Router();
        router.add("GET", "/health", async (_req, res) => {
            HTTPServer_1.HttpServer.json(res, 200, { ok: true, ollama_url: (vscode.workspace.getConfiguration("elevate").get("ollamaUrl") ?? "http://localhost:11434") });
        });
        router.add("GET", "/v1/models", async (_req, res) => {
            try {
                const [tags, ps] = await Promise.all([this.ollama.tags(), this.ollama.ps()]);
                const out = { tags, ps };
                HTTPServer_1.HttpServer.json(res, 200, out);
            }
            catch (e) {
                HTTPServer_1.HttpServer.json(res, 502, { error: "ollama_unreachable", message: String(e?.message ?? e) });
            }
        });
        router.add("GET", "/v1/jobs", async (_req, res, ctx) => {
            const limit = Number(ctx.query["limit"] ?? "50");
            const jobs = await this.queue.listJobs(limit);
            HTTPServer_1.HttpServer.json(res, 200, { jobs });
        });
        router.add("GET", "/v1/jobs/:id", async (_req, res, ctx) => {
            const job = await this.queue.getJob(ctx.params.id);
            if (!job)
                return HTTPServer_1.HttpServer.json(res, 404, { error: "not_found" });
            HTTPServer_1.HttpServer.json(res, 200, job);
        });
        router.add("POST", "/v1/jobs", async (_req, res, ctx) => {
            const body = await ctx.bodyJson();
            if (!body || body.type !== "OLLAMA_CHAT") {
                return HTTPServer_1.HttpServer.json(res, 400, { error: "bad_request", message: "Only OLLAMA_CHAT supported in MVP" });
            }
            const job = await this.queue.enqueueChatJob({
                priority: body.priority ?? 5,
                model: body.model,
                messages: body.payload?.messages ?? [],
                keep_alive: body.keep_alive ?? "5m",
                options: body.options ?? {},
            });
            HTTPServer_1.HttpServer.json(res, 202, { job_id: job.job_id, status: job.status, created_at: job.created_at });
        });
        router.add("POST", "/v1/jobs/:id/cancel", async (_req, res, ctx) => {
            const result = await this.queue.cancelJob(ctx.params.id);
            HTTPServer_1.HttpServer.json(res, 200, result);
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
            const writeEvt = (event, data) => {
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
        this.server = new HTTPServer_1.HttpServer(port, router);
        await this.server.listen("127.0.0.1");
        this.output.appendLine(`[ELEVATE] Backend HTTP server listening on 127.0.0.1:${port}`);
    }
    stop() {
        this.queue.stop();
        void this.server?.close();
        this.server = null;
    }
    async health() {
        return { ok: true, ollama_url: vscode.workspace.getConfiguration("elevate").get("ollamaUrl") ?? "http://localhost:11434" };
    }
    async enqueueChatJob(args) {
        return this.queue.enqueueChatJob(args);
    }
    subscribeJob(jobId, fn) {
        return this.hub.subscribe(jobId, fn);
    }
    async listJobs(limit = 50) {
        return this.queue.listJobs(limit);
    }
    async cancelJob(jobId) {
        return this.queue.cancelJob(jobId);
    }
    async runPipeline(ctx) {
        return this.pipeline.execute(ctx);
    }
    async waitForTerminalStatus(jobId) {
        while (true) {
            const job = await this.queue.getJob(jobId);
            if (!job)
                throw new Error(`Job not found: ${jobId}`);
            if ([types_1.JobStatus.SUCCEEDED, types_1.JobStatus.FAILED, types_1.JobStatus.CANCELED].includes(job.status)) {
                return job;
            }
            await new Promise((r) => setTimeout(r, 100));
        }
    }
}
exports.ElevateBackend = ElevateBackend;
//# sourceMappingURL=ElevateCore.js.map