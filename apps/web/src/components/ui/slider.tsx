import type * as React from "react";

import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  ref?: React.RefObject<React.ElementRef<typeof SliderPrimitive.Root> | null>;
}) => (
  <SliderPrimitive.Root
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    ref={ref}
    {...props}
  >
    {/* Track: Thinner (h-1) and very subtle opacity */}
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-biolum/20">
      <SliderPrimitive.Range className="absolute h-full bg-biolum" />
    </SliderPrimitive.Track>

    {/* Thumb: No border, no shadow, just a clean signal dot */}
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full bg-biolum transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
