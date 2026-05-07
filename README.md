# ELEVATE

**AI-powered code feedback for Python, running entirely on your machine.**

ELEVATE analyzes your Python code as you write it and streams structured feedback — issues, improvements, and complexity notes — directly into a side panel. Everything runs locally via [Ollama](https://ollama.com): no API keys, no data sent to the cloud.

---

## How it works

Open a Python file and ELEVATE gets to work automatically. A native C++ parser reads your code's block structure, a prompt builder turns it into a focused LLM query, and Ollama streams the response back in real time. When your cursor is inside a function or class, analysis scopes to that block rather than the whole file.

The feedback panel shows:

- **Summary** — a one-line description of what the code does
- **Issues** — line-numbered errors, warnings, and notes
- **Complexity** — an assessment of the code's overall complexity
- **Improvements** — suggested refactors with reasoning

---

## Requirements

- [Ollama](https://ollama.com/download) installed and running locally
- A Python file open in the editor
- VS Code 1.109.0 or later

---

## Quick Start

**1. Install Ollama**

**macOS**
```bash
brew install ollama
```
Or download the installer from [ollama.com/download](https://ollama.com/download).

**Linux**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows**

Download the installer from [ollama.com/download](https://ollama.com/download) and run it.

**2. Start Ollama and pull the default model**

```bash
ollama serve
```

> On macOS with the Ollama desktop app, it starts automatically in the menu bar — `ollama serve` is not needed.

Then pull the default model (~2 GB download):

```bash
ollama pull llama3.2:3b
```

Verify everything is working:

```bash
ollama list
```

**3. Install ELEVATE**

Install from the VS Code Marketplace, then open any `.py` file. Analysis starts automatically.

**4. Trigger analysis manually**

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
ELEVATE: Run Prompt (Ollama)
```

The feedback panel opens beside your editor and updates on every edit.

---

## Settings

Configure ELEVATE in **Settings → Extensions → ELEVATE** or in `settings.json`:

| Setting | Default | Description |
|---|---|---|
| `elevate.defaultModel` | `llama3.2:3b` | Ollama model used for analysis |
| `elevate.verbosity` | `balanced` | `concise` · `balanced` · `verbose` — how much detail to include in feedback |
| `elevate.teachingStyle` | `direct` | `direct` · `socratic` · `step-by-step` — how feedback is phrased |
| `elevate.customRules` | _(empty)_ | Extra instructions appended to every analysis (one rule per line) |
| `elevate.ollamaUrl` | `http://localhost:11434` | Ollama base URL if you're running it on a different port or host |
| `elevate.concurrency` | `1` | Max concurrent analysis jobs (1–4) |
| `elevate.editListener.enabled` | `true` | Trigger analysis automatically on edit |
| `elevate.editListener.debounceMs` | `350` | Milliseconds to wait after the last keystroke before analyzing |
| `elevate.editListener.maxWaitMs` | `2500` | Maximum milliseconds to wait before analyzing during continuous typing |
| `elevate.cursorTracking.enabled` | `true` | Scope analysis to the block under the cursor |

### Verbosity

- **concise** — the 2–3 most important issues, brief explanations
- **balanced** — a full issues list with moderate detail (default)
- **verbose** — thorough explanations, all issues, full reasoning

### Teaching style

- **direct** — states issues plainly
- **socratic** — phrases issues as guiding questions so you discover the problem yourself
- **step-by-step** — walks through reasoning one numbered step at a time

### Custom rules

Add any instructions you want applied to every analysis. Examples:

```
Always mention time complexity for loops.
Focus on readability over cleverness.
Assume the reader is a beginner.
```

---

## Commands

| Command | Description |
|---|---|
| `ELEVATE: Run Prompt (Ollama)` | Manually trigger analysis on the active file |
| `ELEVATE: Cancel Job` | Cancel the in-progress analysis |
| `ELEVATE: Open Response Panel` | Bring the feedback panel back into view |
| `ELEVATE: Backend Status` | Show the extension's internal job status |

---

## Troubleshooting

**Panel doesn't appear after opening a Python file**
- Check that Ollama is running: open a terminal and run `ollama list`
- Confirm the model is installed: `ollama pull llama3.2:3b`
- Open the VS Code Output panel and select **ELEVATE** from the dropdown for logs

**"Ollama not responding" or connection errors**
- Make sure `ollama serve` is running (or the Ollama desktop app is open on macOS)
- If you changed the port, update `elevate.ollamaUrl` in settings

**Using a different model**
Pull the model first, then update the setting:
```bash
ollama pull qwen2.5-coder:7b
```
Set `elevate.defaultModel` to `qwen2.5-coder:7b` in settings. Larger models produce better feedback but are slower.

**Analysis seems slow**
- Smaller models (`llama3.2:3b`, `qwen2.5-coder:1.5b`) respond much faster
- Lower `elevate.verbosity` to `concise` to reduce output length
- Raise `elevate.editListener.debounceMs` to reduce how often analysis fires while typing

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions, C++ native component setup, and the test suite.
