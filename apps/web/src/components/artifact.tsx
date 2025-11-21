/**
 * Artifact Component
 *
 * Adapted from ai-sdk.dev/elements/components/artifact
 * Displays droid exec output artifacts
 */

import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ArtifactProps = {
  name: string;
  path: string;
  kind: "file" | "directory" | "code";
  size?: number;
  className?: string;
};

export function Artifact({ name, path, kind, size, className }: ArtifactProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{name}</span>
          <Download className="size-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Path:</span>
          <code className="rounded bg-muted px-2 py-1 text-xs">{path}</code>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Type:</span>
          <span className="text-xs">{kind}</span>
        </div>
        {size !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Size:</span>
            <span className="text-xs">{size} bytes</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
