export class ObjectSet<E extends Record<K, string>, const K extends string> {
  public readonly identifier: K;
  private internalMap: Map<string, E>;

  constructor(identifier: K, initialEntries?: E[]) {
    this.identifier = identifier;
    this.internalMap = new Map();

    if (initialEntries) this.add(...initialEntries);
  }

  public add(...entries: E[]): this {
    for (const entry of entries) {
      const id = entry[this.identifier];

      if (!this.internalMap.has(id)) {
        this.internalMap.set(id, entry);
      }
    }

    return this;
  }

  public delete(entry: string | E): boolean {
    const id = typeof entry === 'string' ? entry : entry[this.identifier];

    return this.internalMap.delete(id);
  }

  public has(entry: string | E): boolean {
    const id = typeof entry === 'string' ? entry : entry[this.identifier];
    return this.internalMap.has(id);
  }

  public clear(): this {
    this.internalMap.clear();
    return this;
  }

  public clone(): ObjectSet<E, K> {
    const copy = new ObjectSet<E, K>(this.identifier);
    copy.internalMap = new Map(this.internalMap);
    return copy;
  }

  public keys(): string[] {
    return Array.from(this.internalMap.keys());
  }

  public values(): E[] {
    return Array.from(this.internalMap.values());
  }

  public get size() {
    return this.internalMap.size;
  }
}
