import { Network } from "lucide-react";

import { VirtualList } from "@/components/ui/virtual-list";
import { cn } from "@/lib/utils";

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

interface NetworkListProps {
  networks: DockerNetwork[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  isLoading?: boolean;
  error?: string;
}

export function NetworkList({
  networks,
  selectedId,
  onSelect,
  className,
  isLoading,
  error,
}: NetworkListProps) {
  return (
    <VirtualList
      className={className}
      data={networks}
      emptyMessage="No networks found"
      error={error}
      headerText={`${networks.length} Network${networks.length !== 1 ? "s" : ""}`}
      isLoading={isLoading}
      renderItem={(n) => (
        <button
          className={cn(
            "w-full rounded-lg p-2 text-left transition-colors",
            n.id === selectedId
              ? "bg-biolum/10 text-biolum"
              : "hover:bg-white/5"
          )}
          onClick={() => onSelect(n.id)}
          type="button"
        >
          <div className="flex items-start gap-2">
            <Network className="mt-0.5 h-4 w-4 flex-shrink-0 text-biolum-dim" />
            <div className="flex-1 overflow-hidden">
              <div className="truncate font-medium text-sm">{n.name}</div>
              <div className="truncate text-biolum-dim text-xs">
                {n.driver} • {n.scope}
              </div>
            </div>
          </div>
        </button>
      )}
    />
  );
}
