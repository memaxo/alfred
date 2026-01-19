export function getCookieFromAuthClient(value: unknown): string | null {
  if (!(typeof value === "object" && value !== null)) {
    return null;
  }

  const getter = (value as { getCookie?: unknown }).getCookie;
  if (typeof getter !== "function") {
    return null;
  }

  try {
    const cookie = (getter as () => unknown)();
    if (typeof cookie === "string" && cookie.trim().length > 0) {
      return cookie;
    }
    return null;
  } catch {
    return null;
  }
}
