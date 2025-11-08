import type { appRouter } from "@alfred/api/src/routers/index";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { authClient } from "@/lib/auth-client";

type AppRouter = typeof appRouter;

export type TRPCAppRouter = AppRouter;

export const trpc: any = createTRPCReact<any>();
export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.EXPO_PUBLIC_SERVER_URL}/api/trpc`,
      headers() {
        const headers = new Map<string, string>();
        const cookies = authClient.getCookie();
        if (cookies) {
          headers.set("Cookie", cookies);
        }
        return Object.fromEntries(headers);
      },
    }),
  ],
});
