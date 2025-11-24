type TrieNode<T> = {
  children: Map<string, TrieNode<T>>;
  value?: T;
  isEndOfWord: boolean;
  usageCount: number; // To track popularity
};

export class PrefixTrie<T> {
  private root: TrieNode<T>;

  constructor() {
    this.root = { children: new Map(), isEndOfWord: false, usageCount: 0 };
  }

  /**
   * Inserts a word with a value and an optional usage score.
   */
  insert(word: string, value: T, score = 0): void {
    let current = this.root;
    const normalized = word.toLowerCase();

    for (const char of normalized) {
      if (!current.children.has(char)) {
        current.children.set(char, {
          children: new Map(),
          isEndOfWord: false,
          usageCount: 0,
        });
      }
      current = current.children.get(char)!;
    }

    current.isEndOfWord = true;
    current.usageCount = Math.max(current.usageCount, score);

    // Only set value if not already set (prioritize first insertion or handle multiples?)
    if (!current.value) {
      current.value = value;
    }
  }

  /**
   * Finds the value associated with the BEST completion of the prefix.
   * Prioritizes higher usage score, then shorter words.
   */
  findCompletion(prefix: string): { completion: string; value: T } | null {
    if (!prefix) return null;

    let current = this.root;
    const normalized = prefix.toLowerCase();

    // 1. Traverse down to the end of the prefix
    for (const char of normalized) {
      if (!current.children.has(char)) {
        return null;
      }
      current = current.children.get(char)!;
    }

    // 2. BFS to find best completion.
    // We want the node with highest usageCount.

    let bestMatch: { completion: string; value: T; score: number } | null =
      null;

    // If the prefix itself is a valid word, it's a strong candidate
    if (current.isEndOfWord && current.value) {
      bestMatch = {
        completion: prefix,
        value: current.value,
        score: current.usageCount,
      };
    }

    const queue: Array<{ node: TrieNode<T>; path: string }> = [
      { node: current, path: "" },
    ];
    const maxDepth = 20; // Limit search space

    let steps = 0;
    while (queue.length > 0 && steps < 100) {
      steps++;
      const { node: curr, path } = queue.shift()!;

      if (curr.isEndOfWord && curr.value) {
        const candidateScore = curr.usageCount;
        // Simple logic: strictly prefer higher usage
        if (!bestMatch || candidateScore > bestMatch.score) {
          bestMatch = {
            completion: prefix + path,
            value: curr.value,
            score: candidateScore,
          };
        }
      }

      const sortedKeys = Array.from(curr.children.keys()).sort();
      for (const key of sortedKeys) {
        if (path.length < maxDepth) {
          queue.push({ node: curr.children.get(key)!, path: path + key });
        }
      }
    }

    return bestMatch
      ? { completion: bestMatch.completion, value: bestMatch.value }
      : null;
  }
}
