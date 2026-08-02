"use client";

/** Thin wrappers around @tauri-apps/plugin-biometric — no-op / unavailable on desktop. */

export type BiometricGateStatus = {
  available: boolean;
  error?: string;
};

export async function biometricStatus(): Promise<BiometricGateStatus> {
  try {
    const { checkStatus } = await import("@tauri-apps/plugin-biometric");
    const status = await checkStatus();
    return {
      available: Boolean(status.isAvailable),
      error: status.error ?? undefined,
    };
  } catch (e) {
    return { available: false, error: String(e) };
  }
}

export async function biometricAuthenticate(reason: string): Promise<void> {
  const { authenticate } = await import("@tauri-apps/plugin-biometric");
  await authenticate(reason, {
    allowDeviceCredential: true,
    title: "Unlock Clavis",
    subtitle: "Confirm it's you to unlock the vault",
    confirmationRequired: false,
  });
}
