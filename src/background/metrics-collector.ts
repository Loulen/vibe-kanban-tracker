/**
 * Metrics Collector for vibe-kanban tracker
 * Aggregates metrics and prepares them for OTLP export
 */

import type { ParsedRoute } from '../content/url-parser';
import type { ProjectNameCache } from './project-name-cache';

export interface MetricRecord {
  name: string;
  type: 'counter' | 'gauge';
  value: number;
  timestamp: number;
  attributes: Record<string, string | number>;
}

export class MetricsCollector {
  private metrics: MetricRecord[] = [];
  private maxQueueSize: number = 1000;
  private projectNameCache?: ProjectNameCache;

  constructor(projectNameCache?: ProjectNameCache) {
    this.projectNameCache = projectNameCache;
  }

  /**
   * Record active time duration
   */
  recordActiveTime(
    durationMs: number,
    route: ParsedRoute,
    machineId: string
  ): void {
    this.addMetric({
      name: 'vibe_kanban.active_time.duration_ms',
      type: 'gauge',
      value: durationMs,
      timestamp: Date.now(),
      attributes: this.buildRouteAttributes(route, machineId),
    });
  }

  /**
   * Record human intervention event
   */
  recordHumanIntervention(route: ParsedRoute, machineId: string): void {
    this.addMetric({
      name: 'vibe_kanban.human_intervention.count',
      type: 'counter',
      value: 1,
      timestamp: Date.now(),
      attributes: this.buildRouteAttributes(route, machineId),
    });
  }

  /**
   * Record scroll event
   */
  recordScroll(distance: number, machineId: string): void {
    // Record scroll count
    this.addMetric({
      name: 'vibe_kanban.scroll.count',
      type: 'counter',
      value: 1,
      timestamp: Date.now(),
      attributes: { machine_id: machineId },
    });

    // Record scroll distance
    this.addMetric({
      name: 'vibe_kanban.scroll.distance_px',
      type: 'counter',
      value: distance,
      timestamp: Date.now(),
      attributes: { machine_id: machineId },
    });
  }

  /**
   * Record view duration (diffs or preview)
   */
  recordViewDuration(
    view: 'diffs' | 'preview',
    durationMs: number,
    route: ParsedRoute,
    machineId: string
  ): void {
    this.addMetric({
      name: 'vibe_kanban.view.duration_ms',
      type: 'gauge',
      value: durationMs,
      timestamp: Date.now(),
      attributes: {
        ...this.buildRouteAttributes(route, machineId),
        view,
      },
    });
  }

  /**
   * Record characters typed
   */
  recordCharactersTyped(
    characterCount: number,
    route: ParsedRoute,
    machineId: string
  ): void {
    this.addMetric({
      name: 'vibe_kanban.characters_typed.count',
      type: 'counter',
      value: characterCount,
      timestamp: Date.now(),
      attributes: this.buildRouteAttributes(route, machineId),
    });
  }

  /**
   * Record message sent with its length
   */
  recordMessageSent(
    messageLength: number,
    route: ParsedRoute,
    machineId: string
  ): void {
    // Record message count
    this.addMetric({
      name: 'vibe_kanban.message_sent.count',
      type: 'counter',
      value: 1,
      timestamp: Date.now(),
      attributes: this.buildRouteAttributes(route, machineId),
    });

    // Record message length
    this.addMetric({
      name: 'vibe_kanban.message_sent.length',
      type: 'gauge',
      value: messageLength,
      timestamp: Date.now(),
      attributes: this.buildRouteAttributes(route, machineId),
    });
  }

  /**
   * Flush all metrics and clear the queue
   * Returns the flushed metrics
   */
  flush(): MetricRecord[] {
    const flushed = [...this.metrics];
    this.metrics = [];
    return flushed;
  }

  /**
   * Get current metrics without clearing
   */
  getMetrics(): MetricRecord[] {
    return [...this.metrics];
  }

  /**
   * Restore metrics (e.g., after failed export)
   */
  restore(metrics: MetricRecord[]): void {
    // Prepend restored metrics, respecting max queue size
    const combined = [...metrics, ...this.metrics];
    this.metrics = combined.slice(-this.maxQueueSize);
  }

  /**
   * Add a metric to the queue, enforcing max size
   */
  private addMetric(metric: MetricRecord): void {
    this.metrics.push(metric);
    console.log('[vibe-tracker] Metric recorded:', metric.name, 'value:', metric.value, 'total queued:', this.metrics.length);

    // Trim if exceeding max queue size (FIFO - remove oldest)
    if (this.metrics.length > this.maxQueueSize) {
      this.metrics = this.metrics.slice(-this.maxQueueSize);
    }
  }

  /**
   * Build common route attributes
   */
  private buildRouteAttributes(
    route: ParsedRoute,
    machineId: string
  ): Record<string, string | number> {
    const attrs: Record<string, string | number> = {
      machine_id: machineId,
      route_type: route.type,
    };

    if (route.workspaceId) {
      attrs.workspace_id = route.workspaceId;
    }
    if (route.projectId) {
      attrs.project_id = route.projectId;
      // Enrich with project name if cache is available and has the name
      if (this.projectNameCache) {
        const projectName = this.projectNameCache.get(route.projectId);
        if (projectName) {
          attrs.project_name = projectName;
        }
      }
    }
    if (route.taskId) {
      attrs.task_id = route.taskId;
    }
    if (route.view) {
      attrs.view = route.view;
    }

    return attrs;
  }
}
