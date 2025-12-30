import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { useCallback, useMemo } from "react";
import { type JarvisHUDConfig, JarvisHUDProvider } from "@/components/hud";
import Loader from "@/components/loader";
import { Toaster } from "@/components/ui/sonner";
import { useJarvisTts } from "@/hooks/use-jarvis-tts";
import Header from "../components/header";
import appCss from "../index.css?url";

export type RouterAppContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "My App",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  const isFetching = useRouterState({ select: (s) => s.isLoading });
  const isProtected = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === "/_protected"),
  });

  const jarvisSpeakEnabled =
    import.meta.env.VITE_JARVIS_SPEAK === "1" ||
    import.meta.env.VITE_JARVIS_SPEAK === "true";
  const { speak } = useJarvisTts({
    enabled: jarvisSpeakEnabled && isProtected,
  });

  const onSpeak = useCallback(
    (message: string) => {
      speak(message, { preface: "none" }).catch(() => {
        // ignore
      });
    },
    [speak]
  );

  const jarvisConfig = useMemo(
    (): JarvisHUDConfig => ({
      statusPanel: isProtected,
      notifications: isProtected,
      ambient: isProtected,
      visualizations: false,
      onSpeak: jarvisSpeakEnabled && isProtected ? onSpeak : undefined,
    }),
    [isProtected, jarvisSpeakEnabled, onSpeak]
  );

  return (
    <html className="dark antialiased" lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <RootProvider>
          <JarvisHUDProvider config={jarvisConfig}>
            <div className="grid h-svh grid-rows-[auto_1fr]">
              <Header />
              {isFetching ? <Loader /> : <Outlet />}
            </div>
          </JarvisHUDProvider>
          <Toaster richColors />
          <TanStackRouterDevtools position="bottom-left" />
          <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
