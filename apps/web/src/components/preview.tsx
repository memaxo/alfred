/**
 * Web Preview Component
 * 
 * Adapted from ai-sdk.dev/elements/components/web-preview
 * Preview deployed app URLs
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
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
          <span className="text-sm text-muted-foreground">Status:</span>
          <span
            className={cn(
              "rounded px-2 py-1 text-xs",
              status === "active" && "bg-green-100 text-green-800",
              status === "preview" && "bg-yellow-100 text-yellow-800",
              status === "failed" && "bg-red-100 text-red-800",
            )}
          >
            {status}
          </span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4 mr-2" />
            Open Preview
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

