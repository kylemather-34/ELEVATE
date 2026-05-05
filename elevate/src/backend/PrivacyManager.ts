import * as vscode from "vscode";
import { JobRecord } from "./types";
import { JobStore } from "./JobStore";

export interface ExportData {
  exported_at: string;
  elevate_version: string;
  note: string;
  total_jobs: number;
  jobs: (JobRecord & { result_text_content: string | null })[];
}

/**
 * Pure function — builds the export payload from already-loaded data.
 * Kept separate so it can be unit-tested without VS Code APIs.
 */
export function buildExportPayload(
  jobs: JobRecord[],
  resultTexts: Map<string, string | null>,
  exportedAt: string = new Date().toISOString()
): ExportData {
  return {
    exported_at: exportedAt,
    elevate_version: "0.0.1",
    note: "All data in this export was processed and stored locally. No data was sent to external servers.",
    total_jobs: jobs.length,
    jobs: jobs.map((j) => ({
      ...j,
      result_text_content: resultTexts.get(j.job_id) ?? null,
    })),
  };
}

export class PrivacyManager {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: JobStore
  ) {}

  /**
   * Delete all stored job history and clear extension settings.
   * The caller is responsible for user confirmation before invoking this.
   */
  async forgetAll(): Promise<void> {
    await this.store.deleteAll();
    for (const key of this.context.globalState.keys()) {
      await this.context.globalState.update(key, undefined);
    }
  }

  /**
   * Serialize all job records (with result texts) to a JSON file chosen by
   * the user via a save dialog. Returns the chosen file path, or null if the
   * user cancelled.
   */
  async exportProgress(): Promise<{ filePath: string } | null> {
    const jobs = await this.store.loadAll();

    const resultTexts = new Map<string, string | null>();
    await Promise.all(
      jobs.map(async (j) => {
        resultTexts.set(j.job_id, await this.store.getResultText(j.job_id));
      })
    );

    const payload = buildExportPayload(jobs, resultTexts);

    const defaultName = `elevate-export-${new Date().toISOString().slice(0, 10)}.json`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(defaultName),
      filters: { JSON: ["json"] },
      title: "Export ELEVATE Progress",
    });
    if (!uri) {
      return null;
    }

    const content = JSON.stringify(payload, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
    return { filePath: uri.fsPath };
  }
}
