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
      </CardContent>
    </Card>
  );
}
