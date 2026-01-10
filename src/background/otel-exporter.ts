/**
 * OpenTelemetry OTLP/HTTP Exporter for vibe-kanban tracker
 * Exports metrics to OTel collector using OTLP JSON format
 */

import type { MetricRecord } from './metrics-collector';

export interface OTelExporterConfig {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  machineId: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export class OTelExporter {
  private config: OTelExporterConfig;

  constructor(config: OTelExporterConfig) {
    this.config = { ...config };
  }

  /**
   * Update the machine ID
   */
  setMachineId(machineId: string): void {
    this.config.machineId = machineId;
  }

  /**
   * Export metrics to OTel collector with retry logic
   * Returns true if export succeeded, false otherwise
   */
  async export(metrics: MetricRecord[]): Promise<boolean> {
    if (metrics.length === 0) {
      return true; // Nothing to export
    }

    const payload = this.formatOTLPPayload(metrics);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(this.config.endpoint + '/v1/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          console.log(
            '[vibe-tracker] Exported ' + metrics.length + ' metrics successfully'
          );
          return true;
        }

        // Non-retryable HTTP errors (4xx except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.error(
            '[vibe-tracker] Export failed with status ' + response.status + ', not retrying'
          );
          return false;
        }

        lastError = new Error('HTTP ' + response.status + ': ' + response.statusText);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          '[vibe-tracker] Export attempt ' + (attempt + 1) + '/' + MAX_RETRIES + ' failed:',
          lastError.message
        );
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await this.sleep(backoffMs);
      }
    }

    console.error(
      '[vibe-tracker] Export failed after ' + MAX_RETRIES + ' attempts:',
      lastError?.message
    );
    return false;
  }

  /**
   * Format metrics into OTLP JSON structure
   */
  private formatOTLPPayload(metrics: MetricRecord[]): OTLPMetricsPayload {
    const otlpMetrics = metrics.map((metric) => this.formatMetric(metric));

    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: this.config.serviceName },
              },
              {
                key: 'service.version',
                value: { stringValue: this.config.serviceVersion },
              },
              {
                key: 'host.name',
                value: { stringValue: this.config.machineId },
              },
            ],
          },
          scopeMetrics: [
            {
              scope: {
                name: this.config.serviceName,
                version: this.config.serviceVersion,
              },
              metrics: otlpMetrics,
            },
          ],
        },
      ],
    };
  }

  /**
   * Format a single metric to OTLP format
   */
  private formatMetric(metric: MetricRecord): OTLPMetric {
    const attributes = Object.entries(metric.attributes).map(([key, value]) => ({
      key,
      value:
        typeof value === 'string'
          ? { stringValue: value }
          : { intValue: String(value) },
    }));

    const dataPoint = {
      attributes,
      timeUnixNano: String(metric.timestamp * 1000000), // ms to ns
      asInt: String(metric.value),
    };

    if (metric.type === 'counter') {
      return {
        name: metric.name,
        sum: {
          dataPoints: [dataPoint],
          aggregationTemporality: 2, // AGGREGATION_TEMPORALITY_CUMULATIVE
          isMonotonic: true,
        },
      };
    } else {
      // gauge
      return {
        name: metric.name,
        gauge: {
          dataPoints: [dataPoint],
        },
      };
    }
  }

  /**
   * Sleep helper for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// OTLP Type definitions
interface OTLPAttribute {
  key: string;
  value: { stringValue: string } | { intValue: string };
}

interface OTLPDataPoint {
  attributes: OTLPAttribute[];
  timeUnixNano: string;
  asInt: string;
}

interface OTLPMetric {
  name: string;
  sum?: {
    dataPoints: OTLPDataPoint[];
    aggregationTemporality: number;
    isMonotonic: boolean;
  };
  gauge?: {
    dataPoints: OTLPDataPoint[];
  };
}

interface OTLPScopeMetrics {
  scope: {
    name: string;
    version: string;
  };
  metrics: OTLPMetric[];
}

interface OTLPResourceMetrics {
  resource: {
    attributes: OTLPAttribute[];
  };
  scopeMetrics: OTLPScopeMetrics[];
}

interface OTLPMetricsPayload {
  resourceMetrics: OTLPResourceMetrics[];
}
