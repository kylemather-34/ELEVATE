"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
class Router {
    routes = [];
    add(method, path, handler) {
        const parts = path.split("/").filter(Boolean);
        this.routes.push({ method: method.toUpperCase(), parts, handler });
    }
    match(method, pathname) {
        const m = method.toUpperCase();
        const parts = pathname.split("/").filter(Boolean);
        for (const r of this.routes) {
            if (r.method !== m)
                continue;
            if (r.parts.length !== parts.length)
                continue;
            const params = {};
            let ok = true;
            for (let i = 0; i < r.parts.length; i++) {
                const rp = r.parts[i];
                const p = parts[i];
                if (rp.startsWith(":"))
                    params[rp.slice(1)] = decodeURIComponent(p);
                else if (rp !== p) {
                    ok = false;
                    break;
                }
            }
            if (ok)
                return { handler: r.handler, params };
        }
        return null;
    }
}
exports.Router = Router;
//# sourceMappingURL=Router.js.map