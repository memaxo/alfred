/**
 * Toolbar Component
 * 
 * Adapted from ai-sdk.dev/elements/components/toolbar
 * Quick action toolbar
 */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolbarAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface ToolbarProps {
  actions: ToolbarAction[];
  className?: string;
}

export function Toolbar({ actions, className }: ToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

