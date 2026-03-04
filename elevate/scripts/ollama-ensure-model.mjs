#!/usr/bin/env node
import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
}

function trySh(cmd) {
  try {
    return { ok: true, out: sh(cmd) };
  } catch (e) {
    return { ok: false, out: "", err: e?.stderr?.toString?.() || e?.message || String(e) };
  }
}

// 1) Check ollama binary
const ollamaV = trySh("ollama --version");
if (!ollamaV.ok) {
  console.log("[ELEVATE] Ollama not found on PATH.");
  console.log("Install Ollama, then run:");
  console.log("  ollama pull llama3.2:3b   (recommended lightweight default)");
  process.exit(0); // don't fail npm install
}

// 2) Decide which model to ensure
const model = process.env.ELEVATE_OLLAMA_MODEL || "llama3.2:3b";
console.log(`[ELEVATE] Ollama detected (${ollamaV.out}).`);
console.log(`[ELEVATE] Ensuring model exists: ${model}`);

// 3) Check whether model exists
const list = trySh("ollama list");
const hasModel = list.ok && list.out.toLowerCase().includes(model.toLowerCase());

if (hasModel) {
  console.log(`[ELEVATE] Model already present: ${model}`);
  process.exit(0);
}

const autoPull = process.env.ELEVATE_AUTO_PULL === "1";
if (!autoPull) {
  console.log(`[ELEVATE] Model '${model}' not found.`);
  console.log("To download it automatically on npm install, run:");
  console.log("  ELEVATE_AUTO_PULL=1 npm install");
  console.log("Or pull manually:");
  console.log(`  ollama pull ${model}`);
  process.exit(0);
}

// 4) Auto pull (opt-in)
console.log(`[ELEVATE] Downloading model: ${model}`);
const pull = trySh(`ollama pull ${model}`);
if (!pull.ok) {
  console.log("[ELEVATE] Pull failed. You can retry manually:");
  console.log(`  ollama pull ${model}`);
  process.exit(0);
}
console.log(`[ELEVATE] Model installed: ${model}`);