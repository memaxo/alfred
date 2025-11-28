import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import Loader from "./components/loader";
import { RouteError } from "./components/route-error";
import "./index.css";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { createBrowserTrpcClient } from "@/lib/trpc-client";
import { routeTree } from "./routeTree.gen";
import { trpc } from "./utils/trpc";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
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
  type Register = {
    router: ReturnType<typeof getRouter>;
  };
}
