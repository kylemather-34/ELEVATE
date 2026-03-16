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
exports.JobStore = void 0;
const vscode = __importStar(require("vscode"));
const json_1 = require("../util/json");
const JOBS_FILE = "jobs.json";
class JobStore {
    context;
    constructor(context) {
        this.context = context;
    }
    async ensureDir() {
        await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
    }
    jobsUri() {
        return vscode.Uri.joinPath(this.context.globalStorageUri, JOBS_FILE);
    }
    jobTextUri(jobId) {
        return vscode.Uri.joinPath(this.context.globalStorageUri, `job_${jobId}.txt`);
    }
    async loadAll() {
        await this.ensureDir();
        try {
            const bytes = await vscode.workspace.fs.readFile(this.jobsUri());
            const txt = Buffer.from(bytes).toString("utf8");
            return (0, json_1.safeJsonParse)(txt, []);
        }
        catch {
            return [];
        }
    }
    async saveAll(jobs) {
        await this.ensureDir();
        const bytes = Buffer.from((0, json_1.safeJsonStringify)(jobs), "utf8");
        await vscode.workspace.fs.writeFile(this.jobsUri(), bytes);
    }
    async upsert(job) {
        const jobs = await this.loadAll();
        const idx = jobs.findIndex((j) => j.job_id === job.job_id);
        if (idx >= 0)
            jobs[idx] = job;
        else
            jobs.unshift(job);
        // keep last 200
        await this.saveAll(jobs.slice(0, 200));
    }
    async setResultText(jobId, text) {
        await this.ensureDir();
        await vscode.workspace.fs.writeFile(this.jobTextUri(jobId), Buffer.from(text, "utf8"));
    }
    async getResultText(jobId) {
        await this.ensureDir();
        try {
            const bytes = await vscode.workspace.fs.readFile(this.jobTextUri(jobId));
            return Buffer.from(bytes).toString("utf8");
        }
        catch {
            return null;
        }
    }
}
exports.JobStore = JobStore;
//# sourceMappingURL=JobStore.js.map