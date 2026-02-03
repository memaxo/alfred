import type { ErrorComponentProps } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const showDebug =
    import.meta.env.DEV || import.meta.env.VITE_TEST_MODE === "true";
  const g = globalThis as unknown as {
    __ALFRED_LAST_ERROR__?: { stack: string | null } | undefined;
  };
  const stack =
    showDebug && error?.stack
      ? error.stack
      : showDebug
        ? (g.__ALFRED_LAST_ERROR__?.stack ?? null)
        : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
        <CardDescription>
          {error.message ?? "An unexpected error occurred"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={reset}>Try again</Button>
        {stack ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
            {stack}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
