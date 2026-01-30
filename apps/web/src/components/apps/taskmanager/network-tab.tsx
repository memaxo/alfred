/**
 * Network Tab - Network connections and bandwidth
 */

import { ArrowDown, ArrowUp, Globe, Loader2, Server } from "lucide-react";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface NetworkTabProps {
  className?: string;
}

interface Connection {
  id: string;
  localAddress: string;
  remoteAddress: string;
  protocol: "tcp" | "udp";
  state: "established" | "listening" | "time_wait";
  process: string;
}

export function NetworkTab({ className }: NetworkTabProps) {
  const { data, isLoading, error, refetch } =
    trpc.admin.networkConnections.useQuery(undefined, {
      refetchInterval: 10_000,
      retry: false,
    });

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  const connections: Connection[] = data?.connections ?? [];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Bandwidth summary (static for now - real bandwidth monitoring would need system integration) */}
      <div className="flex items-center gap-8 border-white/5 border-b p-4">
        <div className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4 text-green-400" />
          <div>
            <div className="font-semibold text-lg">--</div>
            <div className="text-biolum-dim text-xs">Download</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUp className="h-4 w-4 text-orange-400" />
          <div>
            <div className="font-semibold text-lg">--</div>
            <div className="text-biolum-dim text-xs">Upload</div>
          </div>
        </div>
        <div className="ml-auto text-biolum-dim text-xs">
          {connections.length} connections
        </div>
      </div>

      {/* Connection list */}
      <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 font-medium text-biolum-dim text-xs">
        <span className="w-40">Local Address</span>
        <span className="flex-1">Remote Address</span>
        <span className="w-16">Protocol</span>
        <span className="w-24">State</span>
        <span className="w-24">Process</span>
      </div>

      <ScrollArea className="flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-biolum-dim" />
          </div>
        )}
        {error && (
          <div className="py-2 text-center text-red-400 text-xs">
            Failed to load connections
          </div>
        )}
        {!isLoading && connections.length === 0 && !error && (
          <div className="py-4 text-center text-biolum-dim text-sm">
            No connections found
          </div>
        )}
        {connections.map((conn) => (
          <ConnectionRow connection={conn} key={conn.id} />
        ))}
      </ScrollArea>
    </div>
  );
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const stateColors = {
    established: "text-green-400",
    listening: "text-blue-400",
    time_wait: "text-yellow-400",
  };

  const Icon = connection.remoteAddress.includes("0.0.0.0") ? Server : Globe;

  return (
    <div className="flex items-center gap-4 border-white/5 border-b px-4 py-2 text-sm hover:bg-white/5">
      <span className="w-40 font-mono text-biolum-dim text-xs">
        {connection.localAddress}
      </span>
      <span className="flex flex-1 items-center gap-1 font-mono text-xs">
        <Icon className="h-3 w-3 text-biolum-dim" />
        {connection.remoteAddress}
      </span>
      <span className="w-16 text-biolum-dim text-xs uppercase">
        {connection.protocol}
      </span>
      <span className={cn("w-24 text-xs", stateColors[connection.state])}>
        {connection.state}
      </span>
      <span className="w-24 text-biolum-dim text-xs">{connection.process}</span>
    </div>
  );
}
