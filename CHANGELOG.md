# Change Log

## [0.1.0] - 2026-05-01

### Added
- Real-time Python code analysis triggered automatically on edit and on file open
- Native C++ parser that extracts class, function, and block structure from Python files
- Native C++ prompt builder that converts parsed structure into structured LLM prompts
- Ollama integration with NDJSON streaming — responses display token by token as the model generates them
- Cursor-aware analysis — scopes feedback to the block under the cursor (function, class, etc.)
- Structured feedback panel showing summary, issues with line numbers and severity, complexity assessment, and improvement suggestions
- Job queue with priority, cancellation, and deduplication support
- Verbosity setting: concise, balanced, verbose
- Teaching style setting: direct, socratic, step-by-step
- Custom rules: append your own instructions to every analysis prompt
- Status bar indicator showing current pipeline state
- `ELEVATE: Run Prompt` command for manual analysis trigger
- `ELEVATE: Cancel Job` command to cancel in-progress analysis
- `ELEVATE: Open Response Panel` command to bring the feedback panel into view
- Ollama reachability check on activation with actionable warning if not running
