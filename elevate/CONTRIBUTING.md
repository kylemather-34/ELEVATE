# Contributing to ELEVATE

## Prerequisites

| Tool | Minimum Version |
|---|---|
| VS Code | 1.109.0 |
| Node.js | 20.x (LTS recommended) |
| npm | 10.x |
| CMake | 3.20 |
| C++ compiler (GCC or Clang) | C++17 support required |
| Ollama | Latest stable |

---

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd elevate
```

### 2. Install Node.js 20 via nvm

We use [nvm](https://github.com/nvm-sh/nvm) to manage Node versions:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Restart your terminal, then:

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

Verify:
```bash
node --version  # should print v20.x.x
```

### 3. Install Node dependencies

```bash
npm install
```

> During `npm install`, a postinstall script checks if Ollama and the default model (`llama3.2:3b`) are available. It prints instructions if anything is missing but does not fail the install.

> `npm install` also sets up [Husky](https://typicode.github.io/husky/), which adds a pre-push git hook that runs `npm test` before every push. Tests must pass before code can be pushed.

### 4. Install Ollama

**macOS**
```bash
brew install ollama
```
Or download the installer from [https://ollama.com/download](https://ollama.com/download).

**Linux**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Start Ollama:

```bash
# macOS (if not using the desktop app)
ollama serve

# Linux
ollama serve
# or via systemd if registered:
sudo systemctl start ollama
```

Pull the default model:

```bash
ollama pull llama3.2:3b
```

### 5. Build the C++ native components

ELEVATE ships two native C++ binaries:

- **`parser`** — parses Python code and outputs block structure as JSON
- **`prompt_builder`** — transforms parser output into a structured LLM prompt

**macOS**

```bash
xcode-select --install  # if not already installed
cmake -S cpp_native -B cpp_native/build
cmake --build cpp_native/build
```

**Linux**

```bash
# Debian/Ubuntu
sudo apt install build-essential cmake

# Fedora/RHEL
sudo dnf install gcc-c++ cmake

cmake -S cpp_native -B cpp_native/build
cmake --build cpp_native/build
```

After a successful build, both binaries are at:
```
cpp_native/build/bin/parser
cpp_native/build/bin/prompt_builder
```

### 6. Compile the extension

```bash
npm run compile
```

This type-checks, lints, and bundles the TypeScript source into `dist/extension.js`.

### 7. Run the extension in development

Open the project in VS Code and press `F5` to launch the Extension Development Host. A new VS Code window opens with ELEVATE loaded.

To rebuild automatically on file changes:
```bash
npm run watch
```

---

## Running Tests

```bash
npm test
```

This compiles tests, compiles the extension, lints, and runs the Mocha suite inside a VS Code test environment. The suite covers 114 tests across:

- `ElevateContext` — construction and default field values
- `CoreStateManager` — state save/load and error-before-init guards
- `Pipeline` — stage ordering, error propagation, stubbed stage safety
- `OllamaClient` — HTTP request handling, NDJSON streaming, error responses
- `OllamaStage` — prompt validation, delta accumulation, empty stream handling
- `ParseStage` — integration test against the C++ parser binary (skipped if binary not built)
- `SseHub` — event emission, unsubscribe, history retrieval, job isolation
- `JobQueue` — job lifecycle, cancellation, worker success/failure, state transitions

> On headless Linux, VS Code extension tests require a display server. The CI workflow handles this via `xvfb`. To run locally on a headless machine: `xvfb-run -a npm test`.

---

## CI

GitHub Actions runs on every push to `main` and `dev`, and on all pull requests to those branches. The matrix builds and tests on both **Ubuntu** and **macOS**.

Pipeline: checkout → Node.js 20 → `npm ci` → type check → lint → test.

---

## Internal REST API

ELEVATE runs a local HTTP server (default port `34345`) used internally by the extension. Useful for debugging job state during development:

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

## Branch Strategy

- `main` — stable, release-ready
- `dev` — integration branch; PRs merge here first
- Feature branches should be named `feature/<short-description>` or `fix/<short-description>`
