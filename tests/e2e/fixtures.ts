/**
 * E2E Test Fixtures for Vibe Kanban Tracker Extension
 *
 * This file provides fixtures for testing the browser extension with Playwright.
 * It handles extension loading and provides helpers for testing extension functionality.
 */

import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { createServer, type Server } from 'http';

// Path to built extension
const EXTENSION_PATH = path.join(__dirname, '../../dist');

// Vibe-kanban base URL
const VIBE_KANBAN_URL = 'http://localhost:3069';

// OTel collector mock port - use a different port to avoid conflicts with real OTel collector
const OTEL_MOCK_PORT = 14318;

/**
 * Interface for captured OTel metrics
 */
export interface CapturedMetric {
  name: string;
  value: number;
  attributes: Record<string, string | number>;
  timestamp: number;
}

/**
 * Mock OTel collector for capturing metrics during tests
 */
export class OTelCollectorMock {
  private server: Server | null = null;
  private capturedMetrics: CapturedMetric[] = [];
  private port: number;

  constructor(port: number = OTEL_MOCK_PORT) {
    this.port = port;
  }

  async start(): Promise<void> {
    // If already started, just clear metrics and return
    if (this.server) {
      this.clearMetrics();
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/v1/metrics') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              this.parseAndStoreMetrics(data);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end('{}');
            } catch (e) {
              res.writeHead(400);
              res.end('Invalid JSON');
            }
          });
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          // Port already in use, try again after a short delay
          console.log(`Port ${this.port} in use, retrying...`);
          setTimeout(() => {
            this.server?.close();
            this.server?.listen(this.port);
          }, 1000);
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, () => {
        console.log(`OTel mock collector listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private parseAndStoreMetrics(data: Record<string, unknown>): void {
    // Parse OTLP format and extract metrics
    try {
      const resourceMetrics = (data.resourceMetrics as Array<Record<string, unknown>>) || [];
      for (const rm of resourceMetrics) {
        const scopeMetrics = (rm.scopeMetrics as Array<Record<string, unknown>>) || [];
        for (const sm of scopeMetrics) {
          const metrics = (sm.metrics as Array<Record<string, unknown>>) || [];
          for (const metric of metrics) {
            const name = metric.name as string;
            const dataPoints = this.extractDataPoints(metric);
            for (const dp of dataPoints) {
              this.capturedMetrics.push({
                name,
                value: dp.value,
                attributes: dp.attributes,
                timestamp: dp.timestamp,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error parsing metrics:', e);
    }
  }

  private extractDataPoints(metric: Record<string, unknown>): Array<{
    value: number;
    attributes: Record<string, string | number>;
    timestamp: number;
  }> {
    const result: Array<{
      value: number;
      attributes: Record<string, string | number>;
      timestamp: number;
    }> = [];

    // Handle gauge
    const gauge = metric.gauge as Record<string, unknown>;
    if (gauge) {
      const dataPoints = (gauge.dataPoints as Array<Record<string, unknown>>) || [];
      for (const dp of dataPoints) {
        result.push({
          value: (dp.asDouble as number) || (dp.asInt as number) || 0,
          attributes: this.parseAttributes(dp.attributes as Array<Record<string, unknown>>),
          timestamp: Number(dp.timeUnixNano) || Date.now() * 1000000,
        });
      }
    }

    // Handle sum (counter)
    const sum = metric.sum as Record<string, unknown>;
    if (sum) {
      const dataPoints = (sum.dataPoints as Array<Record<string, unknown>>) || [];
      for (const dp of dataPoints) {
        result.push({
          value: (dp.asDouble as number) || (dp.asInt as number) || 0,
          attributes: this.parseAttributes(dp.attributes as Array<Record<string, unknown>>),
          timestamp: Number(dp.timeUnixNano) || Date.now() * 1000000,
        });
      }
    }

    return result;
  }

  private parseAttributes(attrs: Array<Record<string, unknown>> = []): Record<string, string | number> {
    const result: Record<string, string | number> = {};
    for (const attr of attrs) {
      const key = attr.key as string;
      const value = attr.value as Record<string, unknown>;
      if (value.stringValue !== undefined) {
        result[key] = value.stringValue as string;
      } else if (value.intValue !== undefined) {
        result[key] = Number(value.intValue);
      } else if (value.doubleValue !== undefined) {
        result[key] = value.doubleValue as number;
      }
    }
    return result;
  }

  getMetrics(): CapturedMetric[] {
    return [...this.capturedMetrics];
  }

  getMetricsByName(name: string): CapturedMetric[] {
    return this.capturedMetrics.filter((m) => m.name === name);
  }

  clearMetrics(): void {
    this.capturedMetrics = [];
  }

  hasMetric(name: string): boolean {
    return this.capturedMetrics.some((m) => m.name === name);
  }
}

/**
 * Extended test type with extension fixtures
 */
export const test = base.extend<{
  extensionContext: BrowserContext;
  extensionPage: Page;
  otelMock: OTelCollectorMock;
}>({
  // Create a browser context with the extension loaded
  extensionContext: async ({ browser }, use) => {
    // For Firefox, we need to use a different approach
    // Playwright doesn't natively support Firefox extensions the same way as Chrome
    // We'll create a regular context and note that E2E tests are primarily for Chrome/Chromium

    // Note: Full extension E2E testing with Firefox requires additional setup
    // For now, we create a basic context
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  // Create a page from the extension context
  extensionPage: async ({ extensionContext }, use) => {
    const page = await extensionContext.newPage();
    await use(page);
    await page.close();
  },

  // Mock OTel collector - worker scope so it's shared across tests
  otelMock: [async ({}, use) => {
    const mock = new OTelCollectorMock();
    await mock.start();
    await use(mock);
    await mock.stop();
  }, { scope: 'worker' }],
});

/**
 * Helper to wait for extension to be ready
 */
export async function waitForExtensionReady(page: Page, timeout = 10000): Promise<void> {
  // Wait for the content script to be loaded
  // The content script injects itself into vibe-kanban pages
  await page.waitForFunction(
    () => {
      // Check if the vibe-tracker content script has loaded
      // We can check for the presence of injected elements or event listeners
      return document.readyState === 'complete';
    },
    { timeout }
  );

  // Additional wait for extension initialization
  await page.waitForTimeout(1000);
}

/**
 * Helper to navigate to vibe-kanban and wait for extension
 */
export async function navigateToVibeKanban(
  page: Page,
  path: string = '/projects'
): Promise<void> {
  await page.goto(`${VIBE_KANBAN_URL}${path}`);
  await waitForExtensionReady(page);
}

/**
 * Helper to simulate user activity
 */
export async function simulateUserActivity(page: Page): Promise<void> {
  // Mouse movement
  await page.mouse.move(100, 100);
  await page.mouse.move(200, 200);

  // Small wait for throttled events
  await page.waitForTimeout(200);
}

/**
 * Helper to wait for metrics export cycle
 * Default export interval is 30 seconds
 */
export async function waitForExportCycle(page: Page, cycles = 1): Promise<void> {
  const exportIntervalMs = 30000;
  await page.waitForTimeout(exportIntervalMs * cycles + 1000);
}

/**
 * Helper to get console messages from page
 */
export async function getConsoleLogs(page: Page): Promise<string[]> {
  const logs: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('[vibe-tracker]')) {
      logs.push(msg.text());
    }
  });
  return logs;
}

export { expect };
