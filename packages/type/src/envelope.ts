export type EventEnvelope<T> = {
  v: 1;
  id: string;
  type: string;
  createdAt: string;
  resource?: string;
  data: T;
};
