/**
 * Visual Builder Error Boundary
 *
 * Catches and gracefully handles errors in the visual builder component.
 * Provides user-friendly error messages and recovery options.
 */

"use client";

import type { ReactNode } from "react";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { ErrorBoundary } from "@/components/error-boundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function VisualBuilderErrorBoundary({ children, fallback }: Props) {
  if (fallback) {
    return fallback;
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-full items-center justify-center bg-background">
          <Card className="max-w-lg border-red-500/50 shadow-lg">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <CardTitle className="text-red-900 text-xl dark:text-red-100">
                  Visual Builder Error
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert variant="destructive">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription className="text-sm">
                  An unexpected error occurred while loading the Visual Builder.
                  Please try again.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">What you can do</h4>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full"
                      onClick={() => window.location.reload()}
                      variant="default"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reload Page
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
