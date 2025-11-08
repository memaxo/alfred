export class RuntimeContext<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  private readonly map: Map<string, unknown>;

  constructor(entries: Array<[string, unknown]> = []) {
    this.map = new Map<string, unknown>();
    for (const [key, value] of entries) {
      this.map.set(String(key), value);
    }
  }

  get<K extends keyof T & string>(key: K): T[K] | undefined {
    return this.map.get(key) as T[K] | undefined;
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  forEach(callback: (value: unknown, key: string) => void): void {
    for (const [key, value] of this.map.entries()) {
      callback(value, key);
    }
  }

  entries(): Array<[string, unknown]> | IterableIterator<[string, unknown]> {
    return this.map.entries();
  }

  toObject(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.map.entries()) {
      result[key] = value;
    }
    return result;
  }
}
