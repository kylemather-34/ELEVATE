import { execSync } from 'child_process';

// On Linux (WSL2/CI) a virtual display is required to run the VSCode test host.
// xvfb-run provides one. On macOS a display is already available so we skip it.
const cmd = process.platform === 'linux' ? 'xvfb-run -a vscode-test' : 'vscode-test';

execSync(cmd, { stdio: 'inherit' });
