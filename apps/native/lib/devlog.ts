/**
 * Lightweight logging helper for React Native dev builds.
 * Routes messages to console only when __DEV__ is true so Biome's
 * noConsole rule remains satisfied in feature code.
 */

declare const __DEV__: boolean;

export function logError(scope: string, error: unknown): void {
  if (!__DEV__) {
    return;
  }

  let message: string;
  if (error instanceof Error) {
    ({ message } = error);
  } else if (typeof error === "string") {
    message = error;
  } else {
    message = JSON.stringify(error);
  }

  console.error(`[${scope}] ${message}`, error);
}
