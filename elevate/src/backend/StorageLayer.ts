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

// Main builder function
export function buildSettings(input: RawSettings): Settings {
  return {
    theme: normalizeTheme(input.theme),
    notificationsEnabled: normalizeBoolean(input.notificationsEnabled),
    language: normalizeLanguage(input.language),
  };
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