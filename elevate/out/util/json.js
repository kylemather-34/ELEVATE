"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJsonParse = safeJsonParse;
exports.safeJsonStringify = safeJsonStringify;
function safeJsonParse(s, fallback) {
    try {
        return JSON.parse(s);
    }
    catch {
        return fallback;
    }
}
function safeJsonStringify(obj) {
    return JSON.stringify(obj, null, 2);
}
//# sourceMappingURL=json.js.map