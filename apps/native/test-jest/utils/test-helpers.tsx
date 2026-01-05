/**
 * Test Helpers
 *
 * Common utilities for testing React Native components and hooks.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react-native";
import type React from "react";
import { trpc, trpcClient } from "@/utils/trpc";

/**
 * Creates a QueryClient with test-friendly defaults
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component for providers needed in tests
 */
export function TestProviders({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient?: QueryClient;
}) {
  const client = queryClient ?? createTestQueryClient();
  const TrpcProvider = trpc.Provider;

  return (
    <QueryClientProvider client={client}>
      {TrpcProvider ? (
        <TrpcProvider client={trpcClient} queryClient={client}>
          {children}
        </TrpcProvider>
      ) : (
        children
      )}
    </QueryClientProvider>
  );
}

/**
 * Custom render function that includes all providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options ?? {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders queryClient={queryClient}>{children}</TestProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
