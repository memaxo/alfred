// Reset metrics registry between test runs to avoid re-registration errors
import { metricsRegistry } from "@alfred/metrics/registry";

metricsRegistry.clear();
