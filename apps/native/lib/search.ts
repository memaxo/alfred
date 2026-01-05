/**
 * Search Utilities
 *
 * Provides fuzzy search, filtering, and sorting capabilities.
 */

/**
 * Simple fuzzy search implementation
 * Returns a score from 0-1 indicating how well the query matches the text
 */
export function fuzzyMatch(query: string, text: string): number {
  if (!(query && text)) {
    return 0;
  }

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) {
    return 1.0;
  }

  // Starts with query gets high score
  if (textLower.startsWith(queryLower)) {
    return 0.9;
  }

  // Contains query gets medium score
  if (textLower.includes(queryLower)) {
    return 0.7;
  }

  // Fuzzy match: check if all query characters appear in order
  let queryIndex = 0;
  let matchCount = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matchCount++;
      queryIndex++;
    }
  }

  if (queryIndex === queryLower.length) {
    // All characters found in order
    return 0.5 + (matchCount / queryLower.length) * 0.2;
  }

  return 0;
}

/**
 * Search through an array of items with fuzzy matching
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string | string[]
): T[] {
  if (!query.trim()) {
    return items;
  }

  const scored = items
    .map((item) => {
      const searchableTextValue = getSearchableText(item);
      const searchableTexts: string[] = Array.isArray(searchableTextValue)
        ? searchableTextValue
        : [searchableTextValue];

      const maxScore = Math.max(
        ...searchableTexts.map((text: string) => fuzzyMatch(query, text))
      );

      return { item, score: maxScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}

/**
 * Sort options for lists
 */
export type SortOption<T> = {
  key: string;
  label: string;
  sortFn: (a: T, b: T) => number;
};

/**
 * Common sort functions
 */
export const sortFunctions = {
  dateNewest: <
    T extends {
      created?: string | Date | null;
      createdAt?: string | Date | null;
    },
  >(
    a: T,
    b: T
  ) => {
    const valA = a.created || a.createdAt;
    const valB = b.created || b.createdAt;
    const dateA = valA ? new Date(valA).getTime() : 0;
    const dateB = valB ? new Date(valB).getTime() : 0;
    return dateB - dateA;
  },
  dateOldest: <
    T extends {
      created?: string | Date | null;
      createdAt?: string | Date | null;
    },
  >(
    a: T,
    b: T
  ) => {
    const valA = a.created || a.createdAt;
    const valB = b.created || b.createdAt;
    const dateA = valA ? new Date(valA).getTime() : 0;
    const dateB = valB ? new Date(valB).getTime() : 0;
    return dateA - dateB;
  },
  updatedNewest: <
    T extends {
      updated?: string | Date | null;
      updatedAt?: string | Date | null;
    },
  >(
    a: T,
    b: T
  ) => {
    const valA = a.updated || a.updatedAt;
    const valB = b.updated || b.updatedAt;
    const dateA = valA ? new Date(valA).getTime() : 0;
    const dateB = valB ? new Date(valB).getTime() : 0;
    return dateB - dateA;
  },
  titleAsc: <T extends { title?: string | null }>(a: T, b: T) => {
    const titleA = (a.title || "").toLowerCase();
    const titleB = (b.title || "").toLowerCase();
    return titleA.localeCompare(titleB);
  },
  titleDesc: <T extends { title?: string | null }>(a: T, b: T) => {
    const titleA = (a.title || "").toLowerCase();
    const titleB = (b.title || "").toLowerCase();
    return titleB.localeCompare(titleA);
  },
};

/**
 * Filter options
 */
export type FilterOption<T> = {
  key: string;
  label: string;
  filterFn: (item: T) => boolean;
};

/**
 * Common filter functions
 */
export const filterFunctions = {
  hasTags:
    <T extends { tags?: string[] }>(tags: string[]) =>
    (item: T) => {
      if (!item.tags || item.tags.length === 0) {
        return false;
      }
      return tags.some((tag) => item.tags?.includes(tag));
    },
  hasNoTags: <T extends { tags?: string[] }>(item: T) =>
    !item.tags || item.tags.length === 0,
  isCompleted: <T extends { fired?: boolean; completed?: boolean }>(item: T) =>
    item.fired === true || item.completed === true,
  isPending: <T extends { fired?: boolean; completed?: boolean }>(item: T) =>
    item.fired !== true && item.completed !== true,
  dueBefore:
    <T extends { due?: string | Date }>(date: Date) =>
    (item: T) => {
      if (!item.due) {
        return false;
      }
      return new Date(item.due) < date;
    },
  dueAfter:
    <T extends { due?: string | Date }>(date: Date) =>
    (item: T) => {
      if (!item.due) {
        return false;
      }
      return new Date(item.due) > date;
    },
};
