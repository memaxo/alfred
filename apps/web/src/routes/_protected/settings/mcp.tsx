/**
 * MCP Settings Page
 *
 * Configure outbound MCP servers (ALFRED as MCP client).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Plug, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_protected/settings/mcp")({
  component: McpSettingsPage,
});

type Transport = "http" | "sse" | "streamable-http";
type AuthType = "none" | "bearer";

export function McpSettingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.mcp.list.useQuery();

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [transport, setTransport] = useState<Transport>("http");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [bearerEnv, setBearerEnv] = useState("");

  const create = trpc.mcp.create.useMutation({
    onSuccess: async () => {
      toast.success("MCP server added");
      setLabel("");
      setUrl("");
      setTransport("http");
      setAuthType("none");
      setBearerEnv("");
      await utils.mcp.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add MCP server");
    },
  });

  const update = trpc.mcp.update.useMutation({
    onSuccess: async () => {
      await utils.mcp.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update MCP server");
    },
  });

  const remove = trpc.mcp.delete.useMutation({
    onSuccess: async () => {
      toast.success("MCP server removed");
      await utils.mcp.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove MCP server");
    },
  });

  const servers = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const canSubmit =
    label.trim().length > 0 &&
    url.trim().length > 0 &&
    (authType !== "bearer" || bearerEnv.trim().length > 0);

  const submit = () => {
    create.mutate({
      label,
      url,
      transport,
      enabled: true,
      authType,
      ...(authType === "bearer" ? { bearerEnv } : {}),
    });
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-10">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            className="mb-2 inline-flex items-center gap-1 text-biolum-dim text-sm transition-colors hover:text-biolum"
            to="/settings"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to Settings
          </Link>
          <h1 className="font-bold text-3xl text-biolum tracking-tight">
            MCP Servers
          </h1>
          <p className="text-biolum-dim">
            Add outbound MCP servers so Alfred can discover and call their
            tools.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-biolum" strokeWidth={1.5} />
          <h2 className="font-semibold text-biolum text-lg">Add Server</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-biolum-faint text-xs uppercase tracking-wider">
              Label (snake_case)
            </div>
            <Input
              onChange={(e) => setLabel(e.target.value)}
              placeholder="example: linear"
              value={label}
            />
          </div>
          <div className="space-y-1">
            <div className="text-biolum-faint text-xs uppercase tracking-wider">
              URL
            </div>
            <Input
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/mcp"
              value={url}
            />
          </div>
          <div className="space-y-1">
            <div className="text-biolum-faint text-xs uppercase tracking-wider">
              Transport
            </div>
            <Select
              onValueChange={(value) => setTransport(value as Transport)}
              value={transport}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select transport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">http</SelectItem>
                <SelectItem value="sse">sse</SelectItem>
                <SelectItem value="streamable-http">streamable-http</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="text-biolum-faint text-xs uppercase tracking-wider">
              Auth
            </div>
            <Select
              onValueChange={(value) => setAuthType(value as AuthType)}
              value={authType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select auth" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="bearer">bearer (env)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {authType === "bearer" && (
            <div className="space-y-1 sm:col-span-2">
              <div className="text-biolum-faint text-xs uppercase tracking-wider">
                Bearer Token Env Var
              </div>
              <Input
                onChange={(e) => setBearerEnv(e.target.value)}
                placeholder="MCP_LINEAR_TOKEN"
                value={bearerEnv}
              />
              <p className="text-biolum-faint text-xs">
                Alfred reads this token from the server environment at runtime.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button disabled={!canSubmit || create.isPending} onClick={submit}>
            {create.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Add
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
        <h2 className="font-semibold text-biolum text-lg">
          Configured Servers
        </h2>

        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
          </div>
        ) : servers.length > 0 ? (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                key={server.id}
              >
                <div className="min-w-0">
                  <div className="font-medium text-biolum">{server.label}</div>
                  <div className="truncate text-biolum-faint text-xs">
                    {server.url} ({server.transport})
                  </div>
                  <div className="text-biolum-faint text-xs">
                    auth: {server.authType}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="flex items-center gap-2 text-biolum-dim text-xs">
                    <span>enabled</span>
                    <Switch
                      checked={!!server.enabled}
                      onCheckedChange={(checked) =>
                        update.mutate({ id: server.id, enabled: checked })
                      }
                    />
                  </div>
                  <Button
                    className="h-9 w-9 text-red-400"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ id: server.id })}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-xl border border-white/10 border-dashed">
            <p className="text-biolum-faint text-sm">No MCP servers yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
