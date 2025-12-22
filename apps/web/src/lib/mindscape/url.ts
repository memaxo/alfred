/**
 * URL and navigation helpers for Mindscape.
 *
 * Pure functions for manipulating search params and URLs.
 */

import { hasWindow } from "@/lib/env/isomorphic";

/**
 * Clears specified search params from the current URL.
 * Uses replaceState to avoid navigation.
 *
 * @param keys - Array of search param keys to remove
 */
export function clearSearchParams(keys: string[]): void {
  if (!hasWindow()) {
    return;
  }

  const url = new URL(window.location.href);
  let changed = false;

  keys.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }
}

/**
 * Updates a search param in the current URL.
 * Uses replaceState to avoid navigation.
 *
 * @param key - Search param key
 * @param value - Value to set (null removes the param)
 */
export function setSearchParam(key: string, value: string | null): void {
  if (!hasWindow()) {
    return;
  }

  const url = new URL(window.location.href);
  
  if (value === null) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

/**
 * Gets a search param from the current URL.
 *
 * @param key - Search param key
 * @returns The value or null if not present
 */
export function getSearchParam(key: string): string | null {
  if (!hasWindow()) {
    return null;
  }
  
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}
