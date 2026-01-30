/**
 * Search Bar - Semantic and keyword search for entities
 */

import { Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState("");

  return (
    <div className={cn("relative", className)}>
      <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 text-biolum-dim" />
      <Input
        className="h-8 border-white/10 bg-white/5 pl-8 text-sm"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search entities..."
        value={query}
      />
    </div>
  );
}
