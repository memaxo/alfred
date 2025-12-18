/// <reference types="bun-types" />

declare module "bun" {
  export type RedisSetOptions = {
    EX?: number;
    PX?: number;
    NX?: boolean;
    XX?: boolean;
  };

  export type RedisCallback = (message: string) => void;

  export type RedisPubSubListener = (message: string, channel: string) => void;

  export class RedisClient {
    constructor(url?: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    close(): void;
    connected: boolean;
    bufferedAmount: number;
    onconnect: (() => void) | null;
    onclose: ((error?: Error) => void) | null;
    onerror: ((error: Error) => void) | null;
    get(key: string): Promise<string | null>;
    set(
      key: string,
      value: string,
      options?: RedisSetOptions
    ): Promise<unknown>;
    del(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
    ping(): Promise<string>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(
      channels: string[] | string,
      listener: RedisPubSubListener
    ): Promise<number>;
    psubscribe(pattern: string, listener: RedisPubSubListener): Promise<number>;
    unsubscribe(channel: string, listener: RedisPubSubListener): Promise<void>;
    unsubscribe(): Promise<void>;
    punsubscribe(pattern: string, listener: RedisPubSubListener): Promise<void>;
    send(command: string, args: readonly string[]): Promise<unknown>;
    duplicate(): Promise<RedisClient>;
    scan(
      cursor: string,
      options?: { MATCH?: string; COUNT?: number }
    ): Promise<[string, string[]]>;
    sadd(key: string, ...members: string[]): Promise<number>;
    srem(key: string, ...members: string[]): Promise<number>;
    smembers(key: string): Promise<string[]>;
  }

  export const redis: RedisClient;

  // Bun.Terminal API (v1.3.5+)
  export class Terminal {
    constructor(options: {
      cols: number;
      rows: number;
      data: (terminal: Terminal, data: string | Uint8Array) => void;
    });
    write(data: string): void;
    resize(cols: number, rows: number): void;
    close(): void;
    setRawMode(enabled: boolean): void;
    ref(): void;
    unref(): void;
    readonly closed: boolean;
  }

  namespace Spawn {
    type SpawnOptions<
      In extends Spawn.Writable = Spawn.Writable,
      Out extends Spawn.Readable = Spawn.Readable,
      Err extends Spawn.Readable = Spawn.Readable,
    > = {
      /**
       * Terminal options for pseudo-terminal (PTY) support
       * Available in Bun v1.3.5+
       */
      terminal?: {
        cols: number;
        rows: number;
        data: (terminal: Terminal, data: string | Uint8Array) => void;
      };
    };
  }

  type Subprocess<
    In extends Spawn.Writable = Spawn.Writable,
    Out extends Spawn.Readable = Spawn.Readable,
    Err extends Spawn.Readable = Spawn.Readable,
  > = {
    /**
     * Terminal instance (available when spawned with terminal option)
     * Available in Bun v1.3.5+
     */
    terminal?: Terminal;
  };
}

// Bun.Terminal API (v1.3.5+) - Global augmentation
declare global {
  namespace Bun {
    /**
     * Terminal class for pseudo-terminal (PTY) support
     * Available in Bun v1.3.5+
     */
    class Terminal {
      /**
       * Create a new Terminal instance
       */
      constructor(options: {
        cols: number;
        rows: number;
        data: (terminal: Terminal, data: string | Uint8Array) => void;
      });
      /**
       * Write data to the terminal
       */
      write(data: string): void;

      /**
       * Resize the terminal
       */
      resize(cols: number, rows: number): void;

      /**
       * Close the terminal
       */
      close(): void;

      /**
       * Set raw mode (for handling special keys)
       */
      setRawMode(enabled: boolean): void;

      /**
       * Reference the terminal (prevents process from exiting)
       */
      ref(): void;

      /**
       * Unreference the terminal (allows process to exit)
       */
      unref(): void;

      /**
       * Read-only property indicating if terminal is closed
       */
      readonly closed: boolean;
    }

    namespace Spawn {
      type SpawnOptions<
        In extends Spawn.Writable = Spawn.Writable,
        Out extends Spawn.Readable = Spawn.Readable,
        Err extends Spawn.Readable = Spawn.Readable,
      > = {
        /**
         * Terminal options for pseudo-terminal (PTY) support
         * Available in Bun v1.3.5+
         */
        terminal?: {
          cols: number;
          rows: number;
          data: (terminal: Terminal, data: string | Uint8Array) => void;
        };
      };
    }

    type Subprocess<
      In extends Spawn.Writable = Spawn.Writable,
      Out extends Spawn.Readable = Spawn.Readable,
      Err extends Spawn.Readable = Spawn.Readable,
    > = {
      /**
       * Terminal instance (available when spawned with terminal option)
       * Available in Bun v1.3.5+
       */
      terminal?: Terminal;
    };
  }
}
