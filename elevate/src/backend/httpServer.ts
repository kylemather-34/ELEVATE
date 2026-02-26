import { createServer, IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { Router } from "./router";

function sendJson(res: ServerResponse, status: number, obj: any) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function sendText(res: ServerResponse, status: number, text: string) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(text);
}

async function readBodyText(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export class HttpServer {
  private server = createServer(this.onReq.bind(this));

  constructor(private readonly port: number, private readonly router: Router) {}

  listen(host = "127.0.0.1"): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, host, () => resolve());
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async onReq(req: IncomingMessage, res: ServerResponse) {
    try {
      if (!req.url || !req.method) return sendText(res, 400, "Bad request");

      if (req.method.toUpperCase() === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        });
        return res.end();
      }

      const url = new URL(req.url, `http://localhost:${this.port}`);
      const match = this.router.match(req.method, url.pathname);
      if (!match) return sendJson(res, 404, { error: "not_found" });

      const query: Record<string, string> = {};
      url.searchParams.forEach((v, k) => (query[k] = v));

      const ctx = {
        url,
        params: match.params,
        query,
        bodyText: async () => readBodyText(req),
        bodyJson: async <T>() => JSON.parse(await readBodyText(req)) as T,
      };

      await match.handler(req, res, ctx);
    } catch (e: any) {
      sendJson(res, 500, { error: "internal_error", message: String(e?.message ?? e) });
    }
  }

  static json(res: ServerResponse, status: number, obj: any) {
    sendJson(res, status, obj);
  }

  static text(res: ServerResponse, status: number, text: string) {
    sendText(res, status, text);
  }
}