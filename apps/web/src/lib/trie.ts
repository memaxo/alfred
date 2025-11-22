type TrieNode<T> = {
  children: Map<string, TrieNode<T>>;
  value?: T;
  isEndOfWord: boolean;
};

export class PrefixTrie<T> {
  private root: TrieNode<T>;

  constructor() {
    this.root = { children: new Map(), isEndOfWord: false };
  }

  insert(word: string, value: T): void {
    let current = this.root;
    const normalized = word.toLowerCase();

    for (const char of normalized) {
      if (!current.children.has(char)) {
        current.children.set(char, {
          children: new Map(),
          isEndOfWord: false,
        });
      }
      current = current.children.get(char)!;
    }

    current.isEndOfWord = true;
    // Only set value if not already set (prioritize first insertion or handle multiples?)
    // For commands, we might want the "primary" label even if matched via alias
    if (!current.value) {
      current.value = value;
    }
  }

  /**
   * Finds the value associated with the shortest completion of the prefix.
   * e.g. if "star" matches "start", return value for "start".
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

    // 2. BFS to find the shortest completion (closest node with isEndOfWord)
    // Actually DFS/recursion is fine here since we just need *a* valid completion
    // Let's just do a simple greedy traversal for now: pick first child

    const completion = "";
    const node = current;

    // If the prefix itself is a valid word, return it immediately
    // (e.g. user typed "chat" and "chat" is a command)
    if (node.isEndOfWord && node.value) {
      return { completion: prefix, value: node.value };
    }

    // Otherwise find the "first" word in the subtree
    const queue: Array<{ node: TrieNode<T>; path: string }> = [
      { node: current, path: "" },
    ];

    while (queue.length > 0) {
      const { node: curr, path } = queue.shift()!;

      if (curr.isEndOfWord && curr.value) {
        // Reconstruct original casing?
        // For now we return the key we found.
        // The caller usually wants the *Label* (value), not the matched string.
        return { completion: prefix + path, value: curr.value };
      }

      // Sort children to ensure deterministic order (e.g. alpha)
      const sortedKeys = Array.from(curr.children.keys()).sort();
      for (const key of sortedKeys) {
        queue.push({ node: curr.children.get(key)!, path: path + key });
      }
    }

    return null;
  }
}
