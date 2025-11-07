declare module "bun" {
  export interface RedisSetOptions {
    EX?: number;
    PX?: number;
    NX?: boolean;
    XX?: boolean;
  }

  export type RedisCallback = (message: string) => void;

  export type RedisPubSubListener = (message: string, channel: string) => void;

  export class RedisClient {
    constructor(url?: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    close(): void;
    onconnect: (() => void) | null;
    onclose: ((error?: Error) => void) | null;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: RedisSetOptions): Promise<unknown>;
    del(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
    publish(channel: string, message: string): Promise<number>;
    subscribe(channel: string, listener: RedisPubSubListener): Promise<number>;
    subscribe(channels: string[], listener: RedisPubSubListener): Promise<number>;
    psubscribe(pattern: string, listener: RedisPubSubListener): Promise<number>;
    unsubscribe(channel: string, listener: RedisPubSubListener): Promise<void>;
    unsubscribe(): Promise<void>;
    punsubscribe(pattern: string, listener: RedisPubSubListener): Promise<void>;
    send(command: string, args: readonly string[]): Promise<unknown>;
    duplicate(): Promise<RedisClient>;
  }

  export const redis: RedisClient;
}
