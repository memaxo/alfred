/**
 * Animated List Component
 *
 * Adapted from magicui.design/docs/components/animated-list
 * List with entrance animations
 */

import { cn } from "@/lib/utils";

interface ListItem {
  id: string;
  content: React.ReactNode;
}

interface ListProps {
  items: ListItem[];
  className?: string;
}

export function List({ items, className }: ListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <div
          className="fade-in slide-in-from-left animate-in"
          key={item.id}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
