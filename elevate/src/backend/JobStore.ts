import * as vscode from "vscode";
import { JobRecord } from "./types";
import { safeJsonParse, safeJsonStringify } from "../util/json";

const JOBS_FILE = "jobs.json";

// Allowlist for job IDs: UUID format (hex + hyphens, fixed length 36) or
// any alphanumeric/hyphen/underscore up to 128 chars. Prevents path traversal.
export const VALID_JOB_ID_RE = /^[\w-]{1,128}$/;

export function isValidJobId(jobId: string): boolean {
  return VALID_JOB_ID_RE.test(jobId);
}

export class JobStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly context: vscode.ExtensionContext) {}

  private async ensureDir(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
  }

  private jobsUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.context.globalStorageUri, JOBS_FILE);
  }

  private jobTextUri(jobId: string): vscode.Uri {
    if (!isValidJobId(jobId)) {
      throw new Error(`Invalid job ID: "${jobId}"`);
    }
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
    this.writeQueue = this.writeQueue.then(() => this._upsert(job));
    return this.writeQueue;
  }

  private async _upsert(job: JobRecord): Promise<void> {
    const jobs = await this.loadAll();
    const idx = jobs.findIndex((j) => j.job_id === job.job_id);
    if (idx >= 0) jobs[idx] = job;
    else jobs.unshift(job);
    const pruned = jobs.slice(200);
    await this.saveAll(jobs.slice(0, 200));
    await Promise.all(pruned.map((j) => this.deleteResultText(j.job_id)));
  }

  private async deleteResultText(jobId: string): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.jobTextUri(jobId));
    } catch (err) {
      if (err instanceof vscode.FileSystemError && err.code === "FileNotFound") {
        return;
      }
      throw err;
    }
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

  async deleteJobText(jobId: string): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.jobTextUri(jobId));
    } catch {
      // already gone — not an error
    }
  }

  /** Delete all job records and result text files from storage. */
  async deleteAll(): Promise<void> {
    await this.ensureDir();
    try {
      const entries = await vscode.workspace.fs.readDirectory(this.context.globalStorageUri);
      await Promise.all(
        entries
          .filter(([name]) => name.startsWith("job_") && name.endsWith(".txt"))
          .map(([name]) =>
            vscode.workspace.fs.delete(
              vscode.Uri.joinPath(this.context.globalStorageUri, name)
            ).then(undefined, () => {})
          )
      );
    } catch {
      // dir unreadable — continue to overwrite jobs list
    }
    await this.saveAll([]);
  }

  /**
   * Remove jobs (and their result text files) older than `daysToKeep` days.
   * Returns the number of jobs pruned.
   */
  async pruneByRetention(daysToKeep: number): Promise<number> {
    const jobs = await this.loadAll();
    const cutoffMs = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    const { keep, prune } = partitionJobsByRetention(jobs, cutoffMs);
    if (prune.length > 0) {
      await Promise.all(prune.map((j) => this.deleteJobText(j.job_id)));
      await this.saveAll(keep);
    }
    return prune.length;
  }
}

/**
 * Pure function — splits a job list into jobs to keep and jobs to prune.
 * A job is pruned if its created_at timestamp is a valid date older than cutoffMs.
 * Jobs with unparseable dates are kept to avoid accidental data loss.
 */
export function partitionJobsByRetention(
  jobs: JobRecord[],
  cutoffMs: number
): { keep: JobRecord[]; prune: JobRecord[] } {
  const keep: JobRecord[] = [];
  const prune: JobRecord[] = [];
  for (const j of jobs) {
    const ts = new Date(j.created_at).getTime();
    if (!Number.isNaN(ts) && ts < cutoffMs) {
      prune.push(j);
    } else {
      keep.push(j);
    }
  }
  return { keep, prune };
}