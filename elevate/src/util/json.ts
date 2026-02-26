export function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(obj: any): string {
  return JSON.stringify(obj, null, 2);
}