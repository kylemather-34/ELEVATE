import * as vscode from "vscode";
import { JobRecord } from "./types";
import { safeJsonParse, safeJsonStringify } from "../util/json";

const JOBS_FILE = "jobs.json";

export class JobStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private async ensureDir(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
  }

  private jobsUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, JOBS_FILE);
  }

  private jobTextUri(jobId: string): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, `job_${jobId}.txt`);
  }

  async loadAll(): Promise<JobRecord[]> {
    await this.ensureDir();
    try {
      const bytes = await vscode.workspace.fs.readFile(this.jobsUri());
      const txt = Buffer.from(bytes).toString("utf8");
      return safeJsonParse<JobRecord[]>(txt, []);
    } catch {
      return [];
    }
  }

  async saveAll(jobs: JobRecord[]): Promise<void> {
    await this.ensureDir();
    const bytes = Buffer.from(safeJsonStringify(jobs), "utf8");
    await vscode.workspace.fs.writeFile(this.jobsUri(), bytes);
  }

  async upsert(job: JobRecord): Promise<void> {
    const jobs = await this.loadAll();
    const idx = jobs.findIndex((j) => j.job_id === job.job_id);
    if (idx >= 0) jobs[idx] = job;
    else jobs.unshift(job);
    // keep last 200
    await this.saveAll(jobs.slice(0, 200));
  }

  async setResultText(jobId: string, text: string): Promise<void> {
    await this.ensureDir();
    await vscode.workspace.fs.writeFile(this.jobTextUri(jobId), Buffer.from(text, "utf8"));
  }

  async getResultText(jobId: string): Promise<string | null> {
    await this.ensureDir();
    try {
      const bytes = await vscode.workspace.fs.readFile(this.jobTextUri(jobId));
      return Buffer.from(bytes).toString("utf8");
    } catch {
      return null;
    }
  }
}