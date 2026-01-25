import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import "./index.css";
import { CollectionsProvider } from "@/collections";
import { initGenUIRegistry } from "@/components/genui";
import { handleAuthError } from "@/lib/auth-error-handler";
import {
  createBrowserTrpcClient,
  createBrowserTrpcProxyClient,
} from "@/lib/trpc-client";

import Loader from "./components/loader";
import { RouteError } from "./components/route-error";
import { routeTree } from "./routeTree.gen";
import { trpc } from "./utils/trpc";

// Initialize GenUI component registry (async, non-blocking)
initGenUIRegistry().catch((error) => {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const message = error instanceof Error ? error.message : String(error);
    toast.error("GenUI registry initialization failed", {
      description: message,
    });
  }
});

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Handle auth errors first - redirects to login
      if (handleAuthError(error)) {
        return;
      }
      // Show generic error toast for other errors
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      // Handle auth errors for mutations too
      handleAuthError(error);
    },
  }),
  defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

const trpcClient = createBrowserTrpcClient();
const trpcProxyClient = createBrowserTrpcProxyClient();

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    defaultErrorComponent: RouteError,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <CollectionsProvider
            queryClient={queryClient}
            trpcClient={trpcProxyClient}
          >
            {children}
          </CollectionsProvider>
        </trpc.Provider>
      </QueryClientProvider>
    ),
  });
  return router;
};

declare module "@tanstack/react-router" {
  // oxlint-disable useConsistentTypeDefinitions: Module augmentation requires interface for declaration merging
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
