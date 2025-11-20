import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface VoidDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function VoidDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: VoidDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl",
          "shadow-none",
          className
        )}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle className="text-biolum tracking-tighter">{title}</DialogTitle>}
            {description && <DialogDescription className="text-biolum-dim">{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

