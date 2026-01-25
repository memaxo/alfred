/**
 * Type definitions for embed package
 * IPC protocol types for embedding server communication
 */

export interface EmbedRequest {
  id: string;
  type: "embed" | "ping";
  payload: {
    texts?: string[];
  };
}

export interface EmbedResponse {
  id: string;
  type: "embed_response" | "pong" | "error" | "status" | "ready";
  payload: {
    embeddings?: number[][];
    error?: string;
    traceback?: string;
    message?: string;
  };
}

export interface EmbedConfig {
  modelName?: string;
  device?: "auto" | "cpu" | "rocm" | "mps";
  poolSize?: number;
  requestTimeout?: number;
}

export interface ProcessHealth {
  isHealthy: boolean;
  lastPing: number | null;
  requestCount: number;
  errorCount: number;
  uptime: number;
  status: "idle" | "busy" | "error" | "terminated";
  lastActive: number;
}
