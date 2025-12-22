import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import Loader from "./components/loader";
import { RouteError } from "./components/route-error";
import "./index.css";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { handleAuthError } from "@/lib/auth-error-handler";
import { createBrowserTrpcClient } from "@/lib/trpc-client";
import { routeTree } from "./routeTree.gen";
import { trpc } from "./utils/trpc";

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
          {children}
        </trpc.Provider>
      </QueryClientProvider>
    ),
  });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
