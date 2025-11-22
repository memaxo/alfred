/**
 * Type definitions for embed package
 * IPC protocol types for embedding server communication
 */

export type EmbedRequest = {
  id: string;
  type: "embed" | "ping";
  payload: {
    texts?: string[];
  };
};

export type EmbedResponse = {
  id: string;
  type: "embed_response" | "pong" | "error" | "status" | "ready";
  payload: {
    embeddings?: number[][];
    error?: string;
    traceback?: string;
    message?: string;
  };
};

export type EmbedConfig = {
  modelName?: string;
  device?: "auto" | "cpu" | "rocm" | "mps";
  poolSize?: number;
  requestTimeout?: number;
};

export type ProcessHealth = {
  isHealthy: boolean;
  lastPing: number | null;
  requestCount: number;
  errorCount: number;
  uptime: number;
  status: "idle" | "busy" | "error" | "terminated";
  lastActive: number;
};
