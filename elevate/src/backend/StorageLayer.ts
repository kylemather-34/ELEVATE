import * as vscode from "vscode";

// Final JSON structure (what gets stored)
export interface Settings {
  theme: "light" | "dark";
  notificationsEnabled: boolean;
  language: string;
}

// Raw input (from IO layer, can be messy or partial)
export type RawSettings = Partial<{
  theme: unknown;
  notificationsEnabled: unknown;
  language: unknown;
}>;

// Default values
const DEFAULT_SETTINGS: Settings = {
  theme: "light",
  notificationsEnabled: true,
  language: "en",
};

const SETTINGS_KEY = "myExtension.settings";

// Main builder function
export function buildSettings(input: RawSettings): Settings {
  return {
    theme: normalizeTheme(input.theme),
    notificationsEnabled: normalizeBoolean(input.notificationsEnabled),
    language: normalizeLanguage(input.language),
  };
}

// --- Storage functions ---
export async function saveSettings (
  context: vscode.ExtensionContext,
  settings: Settings
): Promise<void>{
  await context.globalState.update(SETTINGS_KEY, settings);
}

export function loadSettings (
  context: vscode.ExtensionContext
): Settings {
  const raw = context.globalState.get<RawSettings>(SETTINGS_KEY, {});
  return buildSettings(raw);
  }

// --- Helper functions ---

function normalizeTheme(value: unknown): "light" | "dark" {
  return value === "dark" ? "dark" : DEFAULT_SETTINGS.theme;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") { return value; }
  if (typeof value === "string") { return value.toLowerCase() === "true"; }
  return DEFAULT_SETTINGS.notificationsEnabled;
}

function normalizeLanguage(value: unknown): string {
  return typeof value === "string" && value.length > 0
    ? value
    : DEFAULT_SETTINGS.language;
}