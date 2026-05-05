import * as vscode from "vscode";
import { spawn, ChildProcess } from "child_process";

export class OllamaProcess {
  private child: ChildProcess | null = null;
  private weStartedIt = false;

  constructor(
    private readonly ollamaUrl: string,
    private readonly output: vscode.OutputChannel
  ) {}

  private async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async start(): Promise<void> {
    if (await this.isRunning()) {
      this.output.appendLine("[ELEVATE] Ollama already running, skipping launch.");
      return;
    }

    const url = new URL(this.ollamaUrl);
    const host = `${url.hostname}:${url.port || "11434"}`;

    this.output.appendLine(`[ELEVATE] Starting Ollama (OLLAMA_HOST=${host})...`);

    this.child = spawn("ollama", ["serve"], {
      env: { ...process.env, OLLAMA_HOST: host },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    this.child.stdout?.on("data", (d: Buffer) =>
      this.output.appendLine(`[ollama] ${d.toString().trimEnd()}`)
    );
    this.child.stderr?.on("data", (d: Buffer) =>
      this.output.appendLine(`[ollama] ${d.toString().trimEnd()}`)
    );

    this.child.on("error", (err) =>
      this.output.appendLine(`[ELEVATE] Ollama process error: ${err.message}`)
    );

    this.child.on("exit", (code, signal) => {
      this.output.appendLine(`[ELEVATE] Ollama exited (code=${code}, signal=${signal})`);
      this.child = null;
    });

    this.weStartedIt = true;
    await this.waitUntilReady(15_000);
  }

  private async waitUntilReady(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isRunning()) {
        this.output.appendLine("[ELEVATE] Ollama is ready.");
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    this.output.appendLine("[ELEVATE] Warning: Ollama did not become ready within timeout.");
  }

  stop(): void {
    if (!this.weStartedIt || !this.child) return;
    this.output.appendLine("[ELEVATE] Stopping Ollama...");
    this.child.kill("SIGTERM");
    this.child = null;
    this.weStartedIt = false;
  }
}
