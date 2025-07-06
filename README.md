# ELEVATE: Enterprise-Level Evaluation of Academic Techniques in Education

**ELEVATE** is an open-source code analysis tool that helps students improve their Python code by highlighting constructs that may be acceptable in coursework but would not meet professional, enterprise-grade coding standards.

Built as a Visual Studio Code extension with a C++ backend and integrated with a locally hosted LLM via [Ollama](https://ollama.com/), ELEVATE offers inline diagnostics and improvement suggestions based on industry best practices.

---

## 🚀 Features

- 🟨 Highlights non-production-grade patterns in student Python code
- 🟥 Flags critical design, logic, or maintainability issues
- 💡 Suggests refactors and best practices via hover tooltips
- 🤖 Uses `codellama:python` through Ollama for local, cost-free AI inference
- ⚙️ Lightweight C++ backend processes and evaluates code via HTTP
- 🧠 Educational tool to train students to write cleaner, more maintainable Python

---

## 🛠️ Architecture Overview

- **Frontend:** VS Code Extension (TypeScript)
- **Backend:** C++17+ HTTP server using `cpp-httplib` and `nlohmann/json`
- **LLM:** `codellama:python` model via Ollama (runs locally)
- **Communication:** REST over `localhost`

---

## 📦 Project Structure

```
elevate/
├── extension/        # VS Code extension (TypeScript)
├── backend/          # C++ backend server
│   ├── main.cpp
│   ├── http_client.cpp/.h
│   ├── response_parser.cpp/.h
│   └── CMakeLists.txt
├── test/             # Unit tests
├── README.md         # This file
├── LICENSE           # Open-source license
└── .env              # (Optional) config overrides
```

---

## 🧪 Example Usage

```python
def connect():
    import os
    f = open('secret.txt')
    data = f.read()
    print(data)
```

**ELEVATE will suggest:**
- Use `with open(...)` to safely handle files
- Replace `print` with proper logging
- Avoid hardcoded file names or sensitive paths

---

## 🔧 Getting Started

### Prerequisites
- Visual Studio Code
- C++17-compatible compiler
- [Ollama](https://ollama.com/) installed
- `codellama:python` model pulled:
  ```bash
  ollama pull codellama:python
  ollama run codellama:python
  ```

### Backend Setup
```bash
cd backend/
mkdir build && cd build
cmake .. && make
./elevate_backend
```

### VS Code Extension Setup
```bash
cd extension/
npm install
npm run compile
code .
# Press F5 to launch development extension host
```
