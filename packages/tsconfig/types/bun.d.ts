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
}
