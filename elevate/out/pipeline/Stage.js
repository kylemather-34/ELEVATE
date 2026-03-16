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
exports.OllamaStage = exports.PromptBuilderStage = exports.ParseStage = exports.SanitizationStage = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
class SanitizationStage {
    name = "Sanitization Stage";
    async run(ctx) {
    }
}
exports.SanitizationStage = SanitizationStage;
class ParseStage {
    binPath;
    name = "Parse Stage";
    constructor(binPath) {
        this.binPath = binPath;
    }
    async run(ctx) {
        const code = ctx.analysisTarget ?? ctx.snapshot?.text ?? ctx.text;
        if (!code) {
            throw new Error("ParseStage: no code to parse");
        }
        const inputPath = path.join(os.tmpdir(), `elevate_in_${Date.now()}.py`);
        const outputPath = path.join(os.tmpdir(), `elevate_out_${Date.now()}.json`);
        await (0, promises_1.writeFile)(inputPath, code, "utf-8");
        await new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(this.binPath, [inputPath, outputPath]);
            let stderr = "";
            proc.stderr.on("data", (d) => (stderr += d.toString()));
            proc.on("close", (code) => {
                if (code !== 0) {
                    reject(new Error(`Parser exited with code ${code}: ${stderr}`));
                }
                else {
                    resolve();
                }
            });
            proc.on("error", reject);
        });
        const raw = await (0, promises_1.readFile)(outputPath, "utf-8");
        ctx.parsed = JSON.parse(raw);
        await (0, promises_1.unlink)(inputPath).catch(() => { });
        await (0, promises_1.unlink)(outputPath).catch(() => { });
    }
}
exports.ParseStage = ParseStage;
class PromptBuilderStage {
    name = "Prompt Builder Stage";
    async run(ctx) {
    }
}
exports.PromptBuilderStage = PromptBuilderStage;
class OllamaStage {
    name = "Ollama Stage";
    async run(ctx) {
    }
}
exports.OllamaStage = OllamaStage;
//# sourceMappingURL=Stage.js.map