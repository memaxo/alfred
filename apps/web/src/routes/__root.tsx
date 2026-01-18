import { TanStackDevtools } from "@tanstack/react-devtools";
import { formDevtoolsPlugin } from "@tanstack/react-form-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { Suspense, useCallback, useMemo } from "react";
import { AlfredDesktopDevtoolsPanel } from "@/components/desktop/devtools-panel";
import { type JarvisHUDConfig, JarvisHUDProvider } from "@/components/hud";
import Loader from "@/components/loader";
import { Toaster } from "@/components/ui/sonner";
import { useJarvisTts } from "@/hooks/use-jarvis-tts";
import Header from "../components/header";
import appCss from "../index.css?url";

const DEVTOOLS_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_DEVTOOLS === "1";

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

  const devtoolsPlugins = useMemo(
    () =>
      [
        formDevtoolsPlugin(),
        {
          name: "Router",
          // biome-ignore lint/suspicious/noExplicitAny: TanStackDevtools requires render property with incompatible type
          render: TanStackRouterDevtoolsPanel as any,
        },
        {
          name: "Query",
          // biome-ignore lint/suspicious/noExplicitAny: TanStackDevtools requires render property with incompatible type
          render: ReactQueryDevtoolsPanel as any,
        },
        {
          name: "Desktop",
          // biome-ignore lint/suspicious/noExplicitAny: TanStackDevtools requires render property with incompatible type
          render: AlfredDesktopDevtoolsPanel as any,
        },
        // biome-ignore lint/suspicious/noExplicitAny: TanStackDevtools requires array with incompatible type
      ] as any,
    []
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
          {DEVTOOLS_ENABLED && (
            <Suspense>
              <TanStackDevtools plugins={devtoolsPlugins} />
            </Suspense>
          )}
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
