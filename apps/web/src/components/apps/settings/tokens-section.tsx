"use client";

/**
 * Tokens Section - Manage API tokens and tool credentials
 *
 * Create, view, and revoke API tokens for external integrations.
 *
 * @see @alfred/auth/token package
 */

import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
};

const mockTokens: ApiToken[] = [
  {
    id: "1",
    name: "CLI Access",
    prefix: "alf_cli_",
    scopes: ["read", "write", "execute"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
    lastUsed: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    name: "GitHub Integration",
    prefix: "alf_gh_",
    scopes: ["read", "workflow"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
    lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "3",
    name: "Agent Tool Token",
    prefix: "alf_tool_",
    scopes: ["execute"],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 23),
  },
];

const scopeColors: Record<string, string> = {
  read: "bg-blue-500/20 text-blue-400",
  write: "bg-orange-500/20 text-orange-400",
  execute: "bg-red-500/20 text-red-400",
  workflow: "bg-purple-500/20 text-purple-400",
};

export function TokensSection() {
  const [showNewToken, setShowNewToken] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">API Tokens</h2>
        <Button
          className="gap-1"
          onClick={() => setShowNewToken(true)}
          size="sm"
        >
          <Plus className="h-3 w-3" />
          Create Token
        </Button>
      </div>

      {showNewToken && (
        <div className="mb-4 rounded-lg border border-biolum/50 bg-biolum/10 p-4">
          <div className="mb-3 font-medium">New Token Created</div>
          <div className="mb-2 flex items-center gap-2">
            <code className="flex-1 rounded bg-void px-3 py-2 font-mono text-sm">
              alf_new_xxxxxxxxxxxxxxxxxxxx
            </code>
            <Button className="h-8 w-8" size="icon" variant="ghost">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-biolum-dim text-xs">
            Copy this token now. You won't be able to see it again.
          </p>
          <Button
            className="mt-2"
            onClick={() => setShowNewToken(false)}
            size="sm"
            variant="outline"
          >
            Done
          </Button>
        </div>
      )}

      <ScrollArea className="h-[calc(100%-100px)]">
        <div className="space-y-3">
          {mockTokens.map((token) => (
            <div
              className="rounded-lg border border-white/10 bg-white/5 p-4"
              key={token.id}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-biolum" />
                  <span className="font-medium">{token.name}</span>
                </div>
                <Button
                  className="gap-1 text-red-400 hover:bg-red-500/20 hover:text-red-400"
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
                <span>Created: {formatDate(token.createdAt)}</span>
                {token.lastUsed && (
                  <span>Last used: {formatTimeAgo(token.lastUsed)}</span>
                )}
                {token.expiresAt && (
                  <span
                    className={cn(
                      token.expiresAt.getTime() - Date.now() <
                        1000 * 60 * 60 * 24 * 7 && "text-yellow-400"
                    )}
                  >
                    Expires: {formatDate(token.expiresAt)}
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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeAgo(date: Date): string {
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
