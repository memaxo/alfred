// Define default usage map
const DEFAULT_USAGE: Record<string, number> = {};

/**
 * Hook to manage command usage history.
 * It persists counts in localStorage (or store if we wanted) to boost frequently used commands.
 */
export function useCommandUsage() {
  // We could integrate this into Zustand, but for simplicity, direct localStorage is fine for now.
  // Or better, let's add it to the mindscape store?
  // For now, let's just use localStorage to avoid modifying the store schema too much if not needed.

  const getUsage = (): Record<string, number> => {
    if (typeof window === "undefined") return DEFAULT_USAGE;
    try {
      const stored = localStorage.getItem("mindscape-command-usage");
      return stored ? JSON.parse(stored) : DEFAULT_USAGE;
    } catch {
      return DEFAULT_USAGE;
    }
  };

  const recordUsage = (commandLabel: string) => {
    if (typeof window === "undefined") return;
    const usage = getUsage();
    usage[commandLabel] = (usage[commandLabel] || 0) + 1;
    localStorage.setItem("mindscape-command-usage", JSON.stringify(usage));
  };

  return { getUsage, recordUsage };
}
