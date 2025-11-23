import { describe, expect, it } from "bun:test";
import { PrefixTrie } from "./trie";

describe("PrefixTrie", () => {
  it("should insert and find exact matches", () => {
    const trie = new PrefixTrie<string>();
    trie.insert("hello", "world");
    
    const result = trie.findCompletion("hello");
    expect(result).toEqual({ completion: "hello", value: "world" });
  });

  it("should find completions for prefixes", () => {
    const trie = new PrefixTrie<string>();
    trie.insert("hello", "world");
    
    const result = trie.findCompletion("hel");
    expect(result?.value).toBe("world");
    expect(result?.completion).toBe("hello");
  });

  it("should return null for non-matching prefixes", () => {
    const trie = new PrefixTrie<string>();
    trie.insert("hello", "world");
    
    const result = trie.findCompletion("xyz");
    expect(result).toBeNull();
  });

  it("should prioritize higher scores", () => {
    const trie = new PrefixTrie<string>();
    // "chat" vs "chart"
    trie.insert("chat", "Chat Command", 10);
    trie.insert("chart", "Chart Command", 5);
    
    // "cha" could match both
    const result = trie.findCompletion("cha");
    
    // Should pick "chat" because score 10 > 5
    expect(result?.value).toBe("Chat Command");
    expect(result?.completion).toBe("chat");
  });

  it("should prioritize shorter words if scores are equal", () => {
    const trie = new PrefixTrie<string>();
    trie.insert("run", "Run", 5);
    trie.insert("runner", "Runner", 5);
    
    const result = trie.findCompletion("run");
    
    // BFS naturally finds shorter words first if depths differ, 
    // but here "run" is a prefix of "runner".
    // If I type "run", it IS an exact match for "Run".
    expect(result?.value).toBe("Run");
  });

  it("should handle case insensitivity", () => {
    const trie = new PrefixTrie<string>();
    trie.insert("Hello", "World");
    
    const result = trie.findCompletion("HEL");
    expect(result?.value).toBe("World");
  });

  it("should handle multiple aliases pointing to same value", () => {
    const trie = new PrefixTrie<string>();
    trie.insert("new note", "New Note Action", 5);
    trie.insert("write", "New Note Action", 2);
    
    expect(trie.findCompletion("new")?.value).toBe("New Note Action");
    expect(trie.findCompletion("wri")?.value).toBe("New Note Action");
  });
});
