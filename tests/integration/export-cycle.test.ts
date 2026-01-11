/**
 * Integration tests for the export cycle
 * Tests the interaction between MetricsCollector, OTelExporter, and StorageManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsCollector, type MetricRecord } from '../../src/background/metrics-collector';
import { testRoutes } from '../fixtures/routes';
import { installFetchMock, createFetchMock } from '../mocks/fetch-mock';

describe('Export Cycle Integration', () => {
  let metricsCollector: MetricsCollector;
  const machineId = 'test-machine';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
    metricsCollector = new MetricsCollector();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Metrics Collection and Export', () => {
    it('should collect event metrics and prepare for export', () => {
      // Record various metrics
      metricsCollector.recordActiveTime(5000, testRoutes.taskDetail, machineId);
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      metricsCollector.recordScroll(500, machineId);
      metricsCollector.recordCharactersTyped(100, testRoutes.taskDetail, machineId);
      metricsCollector.recordMessageSent(256, testRoutes.taskDetail, machineId);

      const metrics = metricsCollector.flush();

      // Should have: active_time, human_intervention, scroll (2), characters_typed, message_sent (2)
      expect(metrics).toHaveLength(7);

      // Verify metric names
      const names = metrics.map((m) => m.name);
      expect(names).toContain('vibe_kanban.active_time.duration_ms');
      expect(names).toContain('vibe_kanban.human_intervention.count');
      expect(names).toContain('vibe_kanban.scroll.count');
      expect(names).toContain('vibe_kanban.scroll.distance_px');
      expect(names).toContain('vibe_kanban.characters_typed.count');
      expect(names).toContain('vibe_kanban.message_sent.count');
      expect(names).toContain('vibe_kanban.message_sent.length');
    });

    it('should clear queue after flush', () => {
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const firstFlush = metricsCollector.flush();
      const secondFlush = metricsCollector.flush();

      expect(firstFlush).toHaveLength(1);
      expect(secondFlush).toHaveLength(0);
    });
  });

  describe('Export Failure Handling', () => {
    it('should restore metrics after failed export', () => {
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      metricsCollector.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const metrics = metricsCollector.flush();
      expect(metricsCollector.getMetrics()).toHaveLength(0);

      // Simulate export failure by restoring metrics
      metricsCollector.restore(metrics);

      expect(metricsCollector.getMetrics()).toHaveLength(2);
    });

    it('should preserve metric order after restore', () => {
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      vi.advanceTimersByTime(1000);
      metricsCollector.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const metrics = metricsCollector.flush();
      metricsCollector.restore(metrics);

      const restored = metricsCollector.getMetrics();
      expect(restored[0].name).toBe('vibe_kanban.human_intervention.count');
      expect(restored[1].name).toBe('vibe_kanban.active_time.duration_ms');
    });

    it('should handle new metrics added after restore', () => {
      const oldMetric: MetricRecord = {
        name: 'old_metric',
        type: 'counter',
        value: 1,
        timestamp: Date.now(),
        attributes: { machine_id: machineId },
      };

      metricsCollector.restore([oldMetric]);
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].name).toBe('old_metric');
      expect(metrics[1].name).toBe('vibe_kanban.human_intervention.count');
    });
  });

  describe('Empty Export Cycle', () => {
    it('should handle empty metrics queue gracefully', () => {
      const metrics = metricsCollector.flush();

      expect(metrics).toEqual([]);
    });
  });

  describe('Metrics Accumulation', () => {
    it('should accumulate metrics across multiple recording calls', () => {
      // Simulate multiple export intervals worth of metrics
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
        vi.advanceTimersByTime(1000);
      }

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(5);

      // Each metric should have different timestamp
      const timestamps = metrics.map((m) => m.timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(5);
    });

    it('should respect max queue size during accumulation', () => {
      // Record more than max queue size
      for (let i = 0; i < 1100; i++) {
        metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      }

      expect(metricsCollector.getMetrics()).toHaveLength(1000);
    });
  });

  describe('Metric Timestamps', () => {
    it('should record accurate timestamps for each metric', () => {
      const startTime = Date.now();

      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      vi.advanceTimersByTime(5000);
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      vi.advanceTimersByTime(5000);
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const metrics = metricsCollector.getMetrics();

      expect(metrics[0].timestamp).toBe(startTime);
      expect(metrics[1].timestamp).toBe(startTime + 5000);
      expect(metrics[2].timestamp).toBe(startTime + 10000);
    });
  });

  describe('Combined Event and API Metrics', () => {
    it('should allow combining event metrics with API metrics', () => {
      // Record event metrics
      metricsCollector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      metricsCollector.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const eventMetrics = metricsCollector.flush();

      // Simulate API metrics (would come from ApiMetricsCollector)
      const apiMetrics: MetricRecord[] = [
        {
          name: 'vibe_kanban.projects.count',
          type: 'gauge',
          value: 5,
          timestamp: Date.now(),
          attributes: { machine_id: machineId },
        },
        {
          name: 'vibe_kanban.tasks.count',
          type: 'gauge',
          value: 25,
          timestamp: Date.now(),
          attributes: { machine_id: machineId, status: 'inprogress' },
        },
      ];

      // Combine for export
      const allMetrics = [...eventMetrics, ...apiMetrics];

      expect(allMetrics).toHaveLength(4);
      expect(allMetrics.map((m) => m.name)).toContain('vibe_kanban.human_intervention.count');
      expect(allMetrics.map((m) => m.name)).toContain('vibe_kanban.projects.count');
    });
  });
});
