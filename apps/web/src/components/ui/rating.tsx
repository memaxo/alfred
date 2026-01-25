import { Star } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
  className?: string;
}

export function Rating({
  value,
  onChange,
  max = 5,
  size = "md",
  readonly = false,
  className,
}: RatingProps) {
  const [hoverValue, setHoverValue] = React.useState(0);

  const handleMouseEnter = (star: number) => {
    if (!readonly) {
      setHoverValue(star);
    }
  };

  const handleMouseLeave = () => {
    setHoverValue(0);
  };

  const handleClick = (star: number) => {
    if (!readonly && onChange) {
      onChange(star);
    }
  };

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const getStarColor = (star: number): string => {
    const activeValue = hoverValue || value;
    if (star <= activeValue) {
      return "text-yellow-400 fill-yellow-400";
    }
    return "text-biolum-dim";
  };

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      onMouseLeave={handleMouseLeave}
    >
      {Array.from({ length: max }).map((_, index) => {
        const star = index + 1;
        return (
          <Star
            className={cn(
              sizeClasses[size],
              getStarColor(star),
              !readonly &&
                "cursor-pointer transition-colors hover:fill-yellow-400 hover:text-yellow-400"
            )}
            key={star}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
          />
        );
      })}
    </div>
  );
}
