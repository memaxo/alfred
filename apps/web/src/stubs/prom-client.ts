type Labels = Record<string, string | number>;

interface MetricConfig {
  name: string;
  help: string;
  labelNames?: string[];
  buckets?: number[];
  registers?: Registry[];
}

export class Registry {
  private readonly metricsByName = new Map<string, unknown>();

  registerMetric(metric: { name?: unknown }): void {
    const name = metric?.name;
    if (typeof name !== "string" || name.length === 0) {
      return;
    }
    this.metricsByName.set(name, metric);
  }

  getSingleMetric(name: string): unknown | undefined {
    return this.metricsByName.get(name);
  }

  removeSingleMetric(name: string): void {
    this.metricsByName.delete(name);
  }

  clear(): void {
    this.metricsByName.clear();
  }

  metrics(): Promise<string> {
    return Promise.resolve("");
  }
}

export const register = new Registry();

function registerSelf(metric: { name?: string }, config: MetricConfig): void {
  metric.name = config.name;
  for (const reg of config.registers ?? []) {
    reg.registerMetric(metric);
  }
}

export class Counter<T extends string = string> {
  readonly labelNames?: readonly T[];
  name?: string;

  constructor(config: MetricConfig) {
    registerSelf(this, config);
  }
  labels(..._values: (string | number)[]): this {
    return this;
  }
  inc(_labels?: Labels, _value?: number): void {}
}

export class Gauge<T extends string = string> {
  readonly labelNames?: readonly T[];
  name?: string;

  constructor(config: MetricConfig) {
    registerSelf(this, config);
  }
  labels(..._values: (string | number)[]): this {
    return this;
  }
  set(_labelsOrValue: Labels | number, _value?: number): void {}
  inc(_labelsOrValue?: Labels | number, _value?: number): void {}
  dec(_labelsOrValue?: Labels | number, _value?: number): void {}
}

export class Histogram<T extends string = string> {
  readonly labelNames?: readonly T[];
  name?: string;

  constructor(config: MetricConfig) {
    registerSelf(this, config);
  }
  labels(..._values: (string | number)[]): this {
    return this;
  }
  observe(_labelsOrValue: Labels | number, _value?: number): void {}
  startTimer(): () => void {
    return () => {};
  }
}

export class Summary<T extends string = string> {
  readonly labelNames?: readonly T[];
  name?: string;

  constructor(config: MetricConfig) {
    registerSelf(this, config);
  }
  labels(..._values: (string | number)[]): this {
    return this;
  }
  observe(_labelsOrValue: Labels | number, _value?: number): void {}
  startTimer(): () => void {
    return () => {};
  }
}

export function collectDefaultMetrics(): void {}

const client = {
  Counter,
  Gauge,
  Histogram,
  Summary,
  Registry,
  collectDefaultMetrics,
  register,
};

export default client;
