import { useDebouncedValue } from "@alfred/pacer/react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced] = useDebouncedValue(value, { wait: delay });
  return debounced;
}
