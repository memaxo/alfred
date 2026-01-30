import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";

export interface SlidingNumberProps {
  value: number;
  format?: (value: number) => string;
  className?: string;
  ariaLabel?: string;
}

export const SlidingNumber = memo(function SlidingNumber({
  value,
  format,
  className,
  ariaLabel,
}: SlidingNumberProps) {
  const reduced = useReducedMotion();

  const formatted = useMemo(() => {
    if (format) {
      return format(value);
    }
    if (!Number.isFinite(value)) {
      return "—";
    }
    return value.toLocaleString();
  }, [format, value]);

  return (
    <span
      aria-label={ariaLabel ?? `Value: ${formatted}`}
      className={cn("inline-flex tabular-nums", className)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -8 }}
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          key={formatted}
          transition={{
            duration: reduced ? 0 : 0.18,
            ease: "easeOut",
          }}
        >
          {formatted}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});
