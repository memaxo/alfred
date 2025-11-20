import type { ReactElement, ReactNode, ComponentType } from "react";
import { render } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import {
  createTRPCClient,
  type TRPCClient,
  type TRPCLink,
} from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";

export type TestTrpcHandler = (input: unknown) => unknown | Promise<unknown>;

export type TestTrpcHandlers = {
  queries?: Record<string, TestTrpcHandler>;
  mutations?: Record<string, TestTrpcHandler>;
  subscriptions?: Record<
    string,
    (
      input: unknown,
      observer: {
        next: (value: unknown) => void;
        error: (error: unknown) => void;
        complete: () => void;
      }
    ) => void | (() => void)
  >;
};

export function createTestQueryClient(
  config: QueryClientConfig = {}
): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        ...(config.defaultOptions?.queries ?? {}),
      },
      mutations: {
        retry: false,
        ...(config.defaultOptions?.mutations ?? {}),
      },
    },
  });
}

export function createTestTrpcClient(
  handlers: TestTrpcHandlers = {}
): TRPCClient<TRPCAppRouter> {
  const handlerLink: TRPCLink<TRPCAppRouter> = () => ({ op }) =>
    observable((observer) => {
      const map =
        op.type === "query"
          ? handlers.queries
          : op.type === "mutation"
            ? handlers.mutations
            : handlers.subscriptions;
      const handler = map?.[op.path];

      if (op.type === "subscription") {
        if (!handler) {
          observer.complete?.();
          return () => undefined;
        }
        const cleanup = handler(op.input, {
          next: (value) =>
            observer.next({
              result: {
                type: "data",
                data: value,
              },
            }),
          error: (error) => observer.error?.(error),
          complete: () => observer.complete?.(),
        });
        return () => {
          if (typeof cleanup === "function") {
            cleanup();
          }
        };
      }

      Promise.resolve(handler ? handler(op.input) : undefined)
        .then((data) => {
          observer.next({
            result: {
              type: "data",
              data,
            },
          });
          observer.complete?.();
        })
        .catch((error) => observer.error?.(error));

      return () => undefined;
    });

  return createTRPCClient<TRPCAppRouter>({
    links: [handlerLink],
  });
}

type RenderRouteOptions = {
  queryClient?: QueryClient;
  trpcClient?: TRPCClient<TRPCAppRouter>;
  wrapper?: ComponentType<{ children: ReactNode }>;
};

export function renderRoute(
  ui: ReactElement,
  options: RenderRouteOptions = {}
) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const trpcClient = options.trpcClient;

  function Wrapper({ children }: { children: ReactNode }) {
    let tree: ReactNode = children;

    if (options.wrapper) {
      const CustomWrapper = options.wrapper;
      tree = <CustomWrapper>{tree}</CustomWrapper>;
    }

    const withQuery = (
      <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>
    );

    if (!trpcClient) {
      return withQuery;
    }

    return (
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {withQuery}
      </trpc.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
