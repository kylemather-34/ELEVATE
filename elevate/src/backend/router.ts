import { IncomingMessage, ServerResponse } from "http";
import { URL } from "url";

export type Handler = (req: IncomingMessage, res: ServerResponse, ctx: {
  url: URL;
  params: Record<string, string>;
  query: Record<string, string>;
  bodyText: () => Promise<string>;
  bodyJson: <T>() => Promise<T>;
}) => Promise<void> | void;

type Route = { method: string; parts: string[]; handler: Handler };

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    const parts = path.split("/").filter(Boolean);
    this.routes.push({ method: method.toUpperCase(), parts, handler });
  }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const m = method.toUpperCase();
    const parts = pathname.split("/").filter(Boolean);

    for (const r of this.routes) {
      if (r.method !== m) continue;
      if (r.parts.length !== parts.length) continue;

      const params: Record<string, string> = {};
      let ok = true;

      for (let i = 0; i < r.parts.length; i++) {
        const rp = r.parts[i];
        const p = parts[i];
        if (rp.startsWith(":")) params[rp.slice(1)] = decodeURIComponent(p);
        else if (rp !== p) { ok = false; break; }
      }

      if (ok) return { handler: r.handler, params };
    }

    return null;
  }
}