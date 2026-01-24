import * as ExpoLinking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Linking } from "react-native";

interface DeepLinkRoute {
  pattern: RegExp;
  handler: (
    matches: RegExpMatchArray,
    router: ReturnType<typeof useRouter>
  ) => void;
}

const DEEP_LINK_ROUTES: DeepLinkRoute[] = [
  {
    pattern: /^alfred:\/\/chat\/([a-zA-Z0-9-]+)$/,
    handler: (matches, router) => {
      const threadId = matches[1];
      router.push({ pathname: "/(drawer)/(tabs)", params: { threadId } });
    },
  },
  {
    pattern: /^alfred:\/\/workflow\/([a-zA-Z0-9-]+)$/,
    handler: (matches, router) => {
      const runId = matches[1];
      router.push({ pathname: "/(drawer)/(tabs)/drive", params: { runId } });
    },
  },
  {
    pattern: /^alfred:\/\/library\/notes\/([a-zA-Z0-9-]+)$/,
    handler: (matches, router) => {
      const noteId = matches[1];
      router.push({ pathname: "/(drawer)/library/notes", params: { noteId } });
    },
  },
  {
    pattern: /^alfred:\/\/library\/reminders\/([a-zA-Z0-9-]+)$/,
    handler: (matches, router) => {
      const reminderId = matches[1];
      router.push({
        pathname: "/(drawer)/library/reminders",
        params: { reminderId },
      });
    },
  },
  {
    pattern: /^alfred:\/\/library\/timers\/([a-zA-Z0-9-]+)$/,
    handler: (matches, router) => {
      const timerId = matches[1];
      router.push({
        pathname: "/(drawer)/library/timers",
        params: { timerId },
      });
    },
  },
  {
    pattern: /^alfred:\/\/library\/bookmarks\/([a-zA-Z0-9-]+)$/,
    handler: (matches, router) => {
      const bookmarkId = matches[1];
      router.push({
        pathname: "/(drawer)/library/bookmarks",
        params: { bookmarkId },
      });
    },
  },
  {
    pattern: /^alfred:\/\/call$/,
    handler: (_, router) => {
      router.push("/(drawer)/call");
    },
  },
  {
    pattern: /^alfred:\/\/focus$/,
    handler: (_, router) => {
      router.push("/(drawer)/focus");
    },
  },
];

function handleDeepLink(url: string, router: ReturnType<typeof useRouter>) {
  for (const route of DEEP_LINK_ROUTES) {
    const matches = url.match(route.pattern);
    if (matches) {
      route.handler(matches, router);
      return true;
    }
  }
  console.warn("Unhandled deep link:", url);
  return false;
}

export function useDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle initial deep link (app launched from deep link)
    const getInitialURL = async () => {
      const initialUrl = await ExpoLinking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl, router);
      }
    };
    getInitialURL();

    // Handle deep links while app is running
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url, router);
    });

    return () => {
      subscription.remove();
    };
  }, [router]);
}

export function createDeepLink(type: string, id?: string): string {
  if (id) {
    return `alfred://${type}/${id}`;
  }
  return `alfred://${type}`;
}
