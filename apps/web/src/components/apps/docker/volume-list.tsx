"use client";

import { HardDrive } from "lucide-react";

import { VirtualList } from "@/components/ui/virtual-list";
import { cn } from "@/lib/utils";

export type DockerVolume = {
  name: string;
  driver: string;
};

type VolumeListProps = {
  volumes: DockerVolume[];
  selectedName: string | null;
  onSelect: (name: string) => void;
  className?: string;
  isLoading?: boolean;
  error?: string;
};

export function VolumeList({
  volumes,
  selectedName,
  onSelect,
  className,
  isLoading,
  error,
}: VolumeListProps) {
  return (
    <VirtualList
      className={className}
      data={volumes}
      emptyMessage="No volumes found"
      error={error}
      headerText={`${volumes.length} Volume${volumes.length !== 1 ? "s" : ""}`}
      isLoading={isLoading}
      renderItem={(v) => (
        <button
          className={cn(
            "w-full rounded-lg p-2 text-left transition-colors",
            v.name === selectedName
              ? "bg-biolum/10 text-biolum"
              : "hover:bg-white/5"
          )}
          onClick={() => onSelect(v.name)}
          type="button"
        >
          <div className="flex items-start gap-2">
            <HardDrive className="mt-0.5 h-4 w-4 flex-shrink-0 text-biolum-dim" />
            <div className="flex-1 overflow-hidden">
              <div className="truncate font-medium text-sm">{v.name}</div>
              <div className="truncate text-biolum-dim text-xs">{v.driver}</div>
            </div>
          </div>
        </button>
      )}
    />
  );
}
