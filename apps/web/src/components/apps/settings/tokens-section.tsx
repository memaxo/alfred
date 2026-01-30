/**
 * Tokens Section - Manage API tokens and tool credentials
 *
 * Create, view, and revoke API tokens for external integrations.
 *
 * @see @alfred/auth/token package
 */

import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

const scopeColors: Record<string, string> = {
  read: "bg-blue-500/20 text-blue-400",
  write: "bg-orange-500/20 text-orange-400",
  execute: "bg-red-500/20 text-red-400",
  workflow: "bg-purple-500/20 text-purple-400",
};

export function TokensSection() {
  const [showNewToken, setShowNewToken] = useState(false);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.token.list.useQuery();
  const revokeMutation = trpc.token.revoke.useMutation({
    onSuccess: () => {
      void utils.token.list.invalidate();
    },
  });
  const issueMutation = trpc.token.issue.useMutation({
    onSuccess: (result) => {
      setNewTokenValue(result.token);
      setShowNewToken(true);
      void utils.token.list.invalidate();
    },
  });

  const handleCreateToken = () => {
    issueMutation.mutate({
      scopes: ["read", "write"],
      name: `Token ${new Date().toISOString().slice(0, 10)}`,
    });
  };

  const handleRevoke = (tokenId: string) => {
    revokeMutation.mutate({ tokenId });
  };

  const handleCopy = () => {
    if (newTokenValue) {
      void navigator.clipboard.writeText(newTokenValue);
    }
  };

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
        Failed to load tokens
      </div>
    );
  }

  const tokens = data?.tokens ?? [];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">API Tokens</h2>
        <Button
          className="gap-1"
          disabled={issueMutation.isPending}
          onClick={handleCreateToken}
          size="sm"
        >
          <Plus className="h-3 w-3" />
          Create Token
        </Button>
      </div>

      {showNewToken && newTokenValue && (
        <div className="mb-4 rounded-lg border border-biolum/50 bg-biolum/10 p-4">
          <div className="mb-3 font-medium">New Token Created</div>
          <div className="mb-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-void px-3 py-2 font-mono text-sm">
              {newTokenValue}
            </code>
            <Button
              className="h-8 w-8"
              onClick={handleCopy}
              size="icon"
              variant="ghost"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-biolum-dim text-xs">
            Copy this token now. You won't be able to see it again.
          </p>
          <Button
            className="mt-2"
            onClick={() => {
              setShowNewToken(false);
              setNewTokenValue(null);
            }}
            size="sm"
            variant="outline"
          >
            Done
          </Button>
        </div>
      )}

      <ScrollArea className="h-[calc(100%-100px)]">
        <div className="space-y-3">
          {tokens.map((token) => (
            <div
              className="rounded-lg border border-white/10 bg-white/5 p-4"
              key={token.id}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-biolum" />
                  <span className="font-medium">{token.name}</span>
                  {token.isExpired && (
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-400 text-xs">
                      Expired
                    </span>
                  )}
                </div>
                <Button
                  className="gap-1 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                  disabled={revokeMutation.isPending}
                  onClick={() => handleRevoke(token.id)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="h-3 w-3" />
                  Revoke
                </Button>
              </div>

              <div className="mb-2 font-mono text-biolum-dim text-sm">
                {token.prefix}••••••••
              </div>

              <div className="mb-2 flex flex-wrap gap-1">
                {token.scopes.map((scope) => (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      scopeColors[scope] ?? "bg-white/10"
                    )}
                    key={scope}
                  >
                    {scope}
                  </span>
                ))}
              </div>

              <div className="flex gap-4 text-biolum-dim text-xs">
                <span>Created: {formatTimestamp(token.createdAt)}</span>
                {token.lastUsedAt && (
                  <span>Last used: {formatTimeAgo(token.lastUsedAt)}</span>
                )}
                {token.expiresAt && (
                  <span className={cn(token.isExpired && "text-red-400")}>
                    Expires: {formatTimestamp(token.expiresAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
