## Prerequisites
Make sure **Node.js** is installed before running the extension.

**VSCode ^1.109.0 required**

---

## Linux/MacOS Setup

### 1. Install nvm
```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
```

If you're on macOS and using zsh
```zsh
source ~/.zshrc
```

### 2. Verify installation
```bash
nvm --version
```

### 3. Install Node (LTS)
```bash
nvm install --lts
```

### 4. Confirm Node is installed
```bash
node -v
```
### Switch to Node 18
```bash
npm install 18
npm use 18
```

## Install Dependencies
```bash
npm install
```

# Make dist folder
```bash
mkdir dist
```

---

## Run the Extension
```bash
npm run compile
```
