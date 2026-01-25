/**
 * Deep Linking Configuration
 *
 * Handles deep links for sharing notes, reminders, and workflows.
 */

import * as Linking from "expo-linking";

export const linking = {
  prefixes: [Linking.createURL("/"), "https://alfred.app", "alfred://"],
  config: {
    screens: {
      "(drawer)": {
        screens: {
          "(tabs)": {
            screens: {
              index: "chat",
              library: {
                screens: {
                  notes: "notes",
                  "notes/[id]": "notes/:id",
                  "notes/new": "notes/new",
                  reminders: "reminders",
                  "reminders/[id]": "reminders/:id",
                  "reminders/new": "reminders/new",
                  timers: "timers",
                  bookmarks: "bookmarks",
                },
              },
              workflows: {
                screens: {
                  index: "workflows",
                  "[id]": "workflows/:id",
                },
              },
              settings: {
                screens: {
                  index: "settings",
                  preferences: "settings/preferences",
                  privacy: "settings/privacy",
                  voice: "settings/voice",
                  memory: "settings/memory",
                },
              },
            },
          },
          focus: "focus",
          call: "call",
        },
      },
    },
  },
};

export function parseDeepLink(url: string): {
  type: "note" | "reminder" | "workflow" | "unknown";
  id?: string;
  path?: string;
} {
  try {
    const parsed = Linking.parse(url);
    const { path } = parsed;

    if (!path) {
      return { type: "unknown" };
    }

    // Handle alfred:// URLs
    if (path.startsWith("notes/")) {
      const id = path.replace("notes/", "").split("/")[0];
      return { type: "note", id, path };
    }

    if (path.startsWith("reminders/")) {
      const id = path.replace("reminders/", "").split("/")[0];
      return { type: "reminder", id, path };
    }

    if (path.startsWith("workflows/")) {
      const id = path.replace("workflows/", "").split("/")[0];
      return { type: "workflow", id, path };
    }

    // Handle https://alfred.app URLs
    if (path.includes("/notes/")) {
      const match = path.match(/\/notes\/([^/]+)/);
      return { type: "note", id: match?.[1], path };
    }

    if (path.includes("/reminders/")) {
      const match = path.match(/\/reminders\/([^/]+)/);
      return { type: "reminder", id: match?.[1], path };
    }

    if (path.includes("/workflows/")) {
      const match = path.match(/\/workflows\/([^/]+)/);
      return { type: "workflow", id: match?.[1], path };
    }

    return { type: "unknown", path };
  } catch {
    return { type: "unknown" };
  }
}

export function generateDeepLink(
  type: "note" | "reminder" | "workflow",
  id: string
): string {
  const baseUrl = "alfred://";
  return `${baseUrl}${type}s/${id}`;
}

export function generateShareLink(
  type: "note" | "reminder" | "workflow",
  id: string
): string {
  const baseUrl = "https://alfred.app";
  return `${baseUrl}/${type}s/${id}`;
}
