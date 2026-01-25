/**
 * Web Preview Component
 *
 * Adapted from ai-sdk.dev/elements/components/web-preview
 * Preview deployed app URLs
 */

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PreviewProps {
  url: string;
  title: string;
  status: "preview" | "active" | "failed";
  className?: string;
}

export function Preview({ url, title, status, className }: PreviewProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Status:</span>
          <span
            className={cn(
              "rounded px-2 py-1 text-xs",
              status === "active" && "bg-green-100 text-green-800",
              status === "preview" && "bg-yellow-100 text-yellow-800",
              status === "failed" && "bg-red-100 text-red-800"
            )}
          >
            {status}
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={url} rel="noopener noreferrer" target="_blank">
            <ExternalLink className="mr-2 size-4" />
            Open Preview
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
