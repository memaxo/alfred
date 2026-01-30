/**
 * Sessions Section - Manage active authentication sessions
 *
 * View, manage, and revoke active sessions across devices.
 *
 * @see @alfred/auth package
 */

import { Globe, Loader2, Shield, Trash2 } from "lucide-react";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export function SessionsSection() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.admin.sessionsList.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  const revokeMutation = trpc.admin.sessionsRevoke.useMutation({
    onSuccess: () => {
      void utils.admin.sessionsList.invalidate();
    },
  });

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-red-400">
        Failed to load sessions
      </div>
    );
  }

  const sessions = data?.sessions ?? [];

  const handleRevoke = (sessionId: string) => {
    revokeMutation.mutate({ sessionId });
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Active Sessions</h2>
        <Button className="gap-1" disabled size="sm" variant="outline">
          <Shield className="h-3 w-3" />
          Revoke All Others
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              className={cn(
                "rounded-lg border p-4",
                session.isCurrent
                  ? "border-biolum/50 bg-biolum/10"
                  : "border-white/10 bg-white/5"
              )}
              key={session.id}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      session.isCurrent ? "bg-biolum/20" : "bg-white/10"
                    )}
                  >
                    <Globe
                      className={cn(
                        "h-5 w-5",
                        session.isCurrent ? "text-biolum" : "text-biolum-dim"
                      )}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {parseUserAgent(session.userAgent)}
                      </span>
                      {session.isCurrent && (
                        <span className="rounded bg-biolum/20 px-1.5 py-0.5 text-biolum text-xs">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex gap-4 text-xs">
                      <span className="text-biolum-dim">
                        Created: {formatDate(session.createdAt)}
                      </span>
                      {session.ipAddress && (
                        <span className="font-mono text-biolum-dim">
                          {session.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <Button
                    className="gap-1 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                    disabled={revokeMutation.isPending}
                    onClick={() => handleRevoke(session.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="h-3 w-3" />
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function parseUserAgent(ua: string | null): string {
  if (!ua) {
    return "Unknown Device";
  }
  // Simple user agent parsing
  if (ua.includes("Chrome")) {
    return "Chrome Browser";
  }
  if (ua.includes("Firefox")) {
    return "Firefox Browser";
  }
  if (ua.includes("Safari")) {
    return "Safari Browser";
  }
  return "Web Browser";
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
