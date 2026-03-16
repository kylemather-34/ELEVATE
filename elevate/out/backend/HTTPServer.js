"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
const http_1 = require("http");
const url_1 = require("url");
function sendJson(res, status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end(body);
}
function sendText(res, status, text) {
    res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end(text);
}
async function readBodyText(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
        req.on("error", reject);
    });
}
class HttpServer {
    port;
    router;
    server = (0, http_1.createServer)(this.onReq.bind(this));
    constructor(port, router) {
        this.port = port;
        this.router = router;
    }
    listen(host = "127.0.0.1") {
        return new Promise((resolve, reject) => {
            this.server.once("error", reject);
            this.server.listen(this.port, host, () => resolve());
        });
    }
    close() {
        return new Promise((resolve) => this.server.close(() => resolve()));
    }
    async onReq(req, res) {
        try {
            if (!req.url || !req.method)
                return sendText(res, 400, "Bad request");
            if (req.method.toUpperCase() === "OPTIONS") {
                res.writeHead(204, {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                });
                return res.end();
            }
            const url = new url_1.URL(req.url, `http://localhost:${this.port}`);
            const match = this.router.match(req.method, url.pathname);
            if (!match)
                return sendJson(res, 404, { error: "not_found" });
            const query = {};
            url.searchParams.forEach((v, k) => (query[k] = v));
            const ctx = {
                url,
                params: match.params,
                query,
                bodyText: async () => readBodyText(req),
                bodyJson: async () => JSON.parse(await readBodyText(req)),
            };
            await match.handler(req, res, ctx);
        }
        catch (e) {
            sendJson(res, 500, { error: "internal_error", message: String(e?.message ?? e) });
        }
    }
    static json(res, status, obj) {
        sendJson(res, status, obj);
    }
    static text(res, status, text) {
        sendText(res, status, text);
    }
}
exports.HttpServer = HttpServer;
//# sourceMappingURL=HTTPServer.js.map