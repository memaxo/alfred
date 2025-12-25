/**
 * A simple p-limit implementation to limit concurrency of async operations.
 * Avoids adding a new dependency for a small utility.
 */
export function pLimit(concurrency: number) {
  const limit = Math.max(1, Math.floor(concurrency));
  const queue: (() => void)[] = [];
  let activeCount = 0;

  const next = () => {
    activeCount = Math.max(0, activeCount - 1);
    if (queue.length > 0) {
      const job = queue.shift();
      if (job) {
        job();
      }
    }
  };

  const run = async <T>(
    fn: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void
  ) => {
    activeCount++;
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      next();
    }
  };

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const job = () => run(fn, resolve, reject);

      if (activeCount < limit) {
        job();
      } else {
        queue.push(job);
      }
    });

  return enqueue;
}

/**
 * A simple async queue for producing/consuming events.
 */
export class AsyncQueue<T> {
  private readonly queue: T[] = [];
  private readonly resolvers: ((
    value: IteratorResult<T, undefined>
  ) => void)[] = [];
  private closed = false;

  enqueue(value: T) {
    if (this.closed) {
      return;
    }
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value, done: false });
    } else {
      this.queue.push(value);
    }
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T, undefined>> => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T, undefined>>((resolve) => {
          this.resolvers.push(resolve);
        });
      },
    };
  }
}
