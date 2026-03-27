# ELEVATE

A VS Code extension that integrates local LLMs (via [Ollama](https://ollama.com)) into your development workflow. ELEVATE analyzes your code as you write it — parsing structure, building prompts, and streaming AI responses directly inside the editor.

---

## Features

- **Real-time code analysis** — triggered automatically on edit (debounced) or immediately on save
- **Local LLM inference** — all processing stays on your machine via Ollama (no cloud required)
- **Python block parser** — native C++ parser extracts class/function/block structure
- **Prompt builder** — native C++ tool transforms parsed structure into structured LLM prompts
- **Streaming responses** — Ollama output streams back to the extension in real time via SSE
- **Job queue** — concurrent job management with priority, cancellation, and deduplication support
- **REST API** — internal HTTP server exposes job management and model endpoints

---

## Requirements

| Requirement | Minimum Version |
|---|---|
| VS Code | 1.109.0 |
| Node.js | 20.x (LTS recommended) |
| npm | 10.x |
| CMake | 3.20 |
| C++ compiler (GCC or Clang) | C++17 support required |
| Ollama | Latest stable |

---

## Developer Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd elevate
```

### 2. Install Node.js 20 via nvm

We use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions. Install it if you haven't:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Restart your terminal, then install and use Node 20:

```bash
nvm install 20
nvm use 20
```

Verify:
```bash
node --version  # should print v20.x.x
```

### 3. Install Node dependencies

```bash
npm install
```

> During `npm install`, a postinstall script runs automatically to check if Ollama and the default model (`llama3.2:3b`) are available. It will print instructions if anything is missing — it will not fail the install.

> `npm install` also installs [Husky](https://typicode.github.io/husky/), which sets up a pre-push git hook that runs `npm test` before every push. **Tests must pass before code can be pushed.**

### 4. Install Ollama

Ollama runs the LLM locally. Download and install it for your platform:

**macOS**
```bash
brew install ollama
```
Or download the installer from [https://ollama.com/download](https://ollama.com/download).

**Linux**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

After installing, start the Ollama service:

**macOS**
```bash
ollama serve
```
> On macOS, Ollama may also run as a menu bar app if you used the GUI installer — in that case `ollama serve` is not needed.

**Linux**
```bash
ollama serve
# or via systemd (if registered):
sudo systemctl start ollama
```

Verify Ollama is running:
```bash
ollama list
```

### 5. Pull the default model

ELEVATE uses `llama3.2:3b` by default — a lightweight 3B-parameter model that runs well on most machines.

```bash
ollama pull llama3.2:3b
```

> This is roughly a 2 GB download. Progress will be shown in the terminal.

To auto-pull the model during `npm install` in the future:
```bash
ELEVATE_AUTO_PULL=1 npm install
```

To use a different model, pull it and update the `elevate.defaultModel` setting in VS Code:
```bash
ollama pull llama3.2:8b   # larger, more capable
ollama pull mistral        # alternative model
```

### 6. Build the C++ native components

ELEVATE ships two native C++ binaries that must be compiled before running the extension:

- **`parser`** — parses Python code and outputs block structure as JSON
- **`prompt_builder`** — transforms parser JSON output into a structured LLM prompt

Both are built together with a single CMake build.

**macOS**

Ensure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

Then build:
```bash
cmake -S cpp_native -B cpp_native/build
cmake --build cpp_native/build
```

**Linux**

Install build tools if needed:
```bash
# Debian/Ubuntu
sudo apt install build-essential cmake

# Fedora/RHEL
sudo dnf install gcc-c++ cmake
```

Then build:
```bash
cmake -S cpp_native -B cpp_native/build
cmake --build cpp_native/build
```

After a successful build, both binaries will be at:
```
cpp_native/build/bin/parser
cpp_native/build/bin/prompt_builder
```

### 7. Compile the extension

```bash
npm run compile
```

This type-checks, lints, and bundles the TypeScript source into `dist/extension.js`.

### 8. Run the extension in development

Open the project in VS Code and press `F5` to launch the Extension Development Host. This opens a new VS Code window with ELEVATE loaded.

Alternatively, use the watch mode to rebuild automatically on file changes:
```bash
npm run watch
```

---

## Extension Settings

These can be configured in your VS Code `settings.json` or via the Settings UI under **ELEVATE**:

| Setting | Default | Description |
|---|---|---|
| `elevate.ollamaUrl` | `http://localhost:11434` | Ollama REST API base URL |
| `elevate.defaultModel` | `llama3.2:3b` | Ollama model to use for analysis |
| `elevate.backendPort` | `34345` | Local HTTP port for the extension's internal server |
| `elevate.concurrency` | `1` | Max concurrent Ollama jobs (1–4) |
| `elevate.cursorTracking.enabled` | `true` | Track cursor position |
| `elevate.editListener.enabled` | `true` | Trigger analysis on editor edits |
| `elevate.editListener.debounceMs` | `350` | Debounce delay (ms) after last edit |
| `elevate.editListener.maxWaitMs` | `2500` | Max wait (ms) before firing during continuous typing |
| `elevate.fileWatcher.enabled` | `false` | Watch for on-disk file changes (external editors) |
| `elevate.fileWatcher.glob` | `**/*` | Glob pattern for the file system watcher |

---

## Available Commands

Access these via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Description |
|---|---|
| `ELEVATE: Run Prompt (Ollama)` | Manually trigger an analysis on the current file |
| `ELEVATE: Cancel Job` | Cancel the currently running job |
| `ELEVATE: Backend Status` | Open the backend status panel |
| `ELEVATE: Show Cursor Position` | Display current cursor position |

---

## Internal REST API

ELEVATE runs a local HTTP server (default port `34345`) exposing these endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Backend health check |
| `GET` | `/v1/models` | List available Ollama models |
| `GET` | `/v1/jobs` | List jobs (paginated) |
| `GET` | `/v1/jobs/:id` | Get a specific job |
| `POST` | `/v1/jobs` | Enqueue a new job |
| `POST` | `/v1/jobs/:id/cancel` | Cancel a job |
| `GET` | `/v1/jobs/:id/events` | SSE stream of real-time job events |

---

## Running Tests

```bash
npm test
```

This compiles tests, compiles the extension, lints, and runs the Mocha test suite inside a VS Code test environment. The suite covers 27+ tests across:

- `ElevateContext` — construction and default field values
- `CoreStateManager` — state save/load and error-before-init guards
- `Pipeline` — stage ordering, error propagation, stubbed stage safety
- `OllamaClient` — HTTP request handling, NDJSON streaming, error responses
- `OllamaStage` — prompt validation, delta accumulation, empty stream handling
- `ParseStage` — integration test against the C++ parser binary (skipped if binary not built)
- `SseHub` — event emission, unsubscribe, history retrieval, job isolation
- `JobQueue` — job lifecycle, cancellation, worker success/failure, state transitions

> On Linux, VSCode extension tests require a display server. The CI workflow handles this automatically via `xvfb`. If running locally on a headless Linux machine, prefix with `xvfb-run -a npm test`.

---

## CI

GitHub Actions runs on every push to `main` and `dev`, and on all pull requests to those branches. The matrix builds and tests on both **Ubuntu** and **macOS**.

Pipeline steps: checkout → Node.js 20 setup → `npm ci` → type check → lint → test.

---

## Troubleshooting

**Ollama not responding**
- Make sure `ollama serve` is running in a terminal (or the Ollama app is open on macOS)
- Check that the URL in `elevate.ollamaUrl` matches where Ollama is listening (default: `http://localhost:11434`)

**Model not found**
- Run `ollama list` to see installed models
- Pull the model: `ollama pull llama3.2:3b`

**Parser or prompt_builder binary missing**
- Both C++ binaries must be built manually — see step 5 above
- Confirm the binaries exist at `cpp_native/build/bin/parser` and `cpp_native/build/bin/prompt_builder`
- The `ParseStage` integration test will be skipped automatically if the binary is not present

**Extension not activating**
- Ensure `npm run compile` has been run and `dist/extension.js` exists
- Check the VS Code Output panel → select **ELEVATE** from the dropdown for logs
