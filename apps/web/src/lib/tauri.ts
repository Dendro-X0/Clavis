export async function isTauri(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return Boolean(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__,
  );
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}
