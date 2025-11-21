import { createServerFn } from "@tanstack/start/server";
import { calculateAsciiFrame } from "@/lib/mindscape/ascii";

export const fetchInitialMindscape = createServerFn({ method: "GET" }).handler(
  async () => {
    // Generate a standard grid.
    // 160x60 is a reasonable default for desktop (approx 1600x1200 with 10x20 font)
    // It will be clipped by CSS anyway.
    const ascii = calculateAsciiFrame(160, 60);
    return { ascii };
  }
);
