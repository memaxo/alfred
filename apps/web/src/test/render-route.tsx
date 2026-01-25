import type { ComponentType, ReactElement, ReactNode } from "react";

import {
  QueryClient,
  type QueryClientConfig,
  QueryClientProvider,
} from "@tanstack/react-query";
import { createTRPCClient, type TRPCClient, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";

import { render } from "@/test/testing-library";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

export type TestTrpcHandler = (input: unknown) => unknown | Promise<unknown>;

export interface TestTrpcHandlers {
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
    ) => undefined | (() => void)
  >;
}

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
  const handlerLink: TRPCLink<TRPCAppRouter> =
    () =>
    ({ op }) =>
      observable((observer) => {
        const map =
          op.type === "query"
            ? handlers.queries
            : (op.type === "mutation"
              ? handlers.mutations
              : handlers.subscriptions);
        const handler = map?.[op.path];

        if (op.type === "subscription") {
          if (!handler) {
            observer.complete?.();
            return () => {};
          }
          const subscriptionHandler = handler as (
            input: unknown,
            observer: {
              next: (value: unknown) => void;
              error: (error: unknown) => void;
              complete: () => void;
            }
          ) => undefined | (() => void);
          const cleanup = subscriptionHandler(op.input, {
            next: (value) =>
              observer.next({
                result: {
                  type: "data",
                  data: value,
                },
              }),
            error: (error) =>
              observer.error?.(error as Parameters<typeof observer.error>[0]),
            complete: () => observer.complete?.(),
          });
          return () => {
            if (typeof cleanup === "function") {
              cleanup();
            }
          };
        }

        const queryOrMutationHandler = handler as TestTrpcHandler | undefined;
        Promise.resolve(
          queryOrMutationHandler ? queryOrMutationHandler(op.input) : undefined
        )
          .then((data) => {
            observer.next({
              result: {
                type: "data",
                data,
              },
            });
            observer.complete?.();
          })
          .catch((error) =>
            observer.error?.(error as Parameters<typeof observer.error>[0])
          );

        return () => {};
      });

  return createTRPCClient<TRPCAppRouter>({
    links: [handlerLink],
  });
}

export interface RenderRouteOptions {
  queryClient?: QueryClient;
  trpcClient?: TRPCClient<TRPCAppRouter>;
  wrapper?: ComponentType<{ children: ReactNode }>;
}

export function renderRoute(
  ui: ReactElement,
  options: RenderRouteOptions = {}
) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const { trpcClient } = options;

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
