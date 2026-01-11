/**
 * Unit tests for MetricsCollector
 * Tests metric recording, aggregation, and queue management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCollector, type MetricRecord } from '../../../src/background/metrics-collector';
import type { ParsedRoute } from '../../../src/content/url-parser';
import { testRoutes, testUUIDs } from '../../fixtures/routes';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  const machineId = 'test-machine-001';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
    collector = new MetricsCollector();
  });

  describe('recordActiveTime', () => {
    it('should record active time metric with correct name and type', () => {
      collector.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('vibe_kanban.active_time.duration_ms');
      expect(metrics[0].type).toBe('gauge');
    });

    it('should record duration value correctly', () => {
      const durationMs = 12345;
      collector.recordActiveTime(durationMs, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].value).toBe(durationMs);
    });

    it('should include route attributes', () => {
      collector.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes).toMatchObject({
        machine_id: machineId,
        route_type: 'task_detail',
        project_id: testUUIDs.project1,
        task_id: testUUIDs.task1,
      });
    });

    it('should include view attribute when present', () => {
      collector.recordActiveTime(5000, testRoutes.taskDetailWithDiffs, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes.view).toBe('diffs');
    });

    it('should set timestamp to current time', () => {
      collector.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].timestamp).toBe(Date.now());
    });
  });

  describe('recordHumanIntervention', () => {
    it('should record human intervention as counter with value 1', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('vibe_kanban.human_intervention.count');
      expect(metrics[0].type).toBe('counter');
      expect(metrics[0].value).toBe(1);
    });

    it('should include route attributes', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes).toMatchObject({
        machine_id: machineId,
        route_type: 'task_detail',
        project_id: testUUIDs.project1,
        task_id: testUUIDs.task1,
      });
    });

    it('should record multiple interventions as separate metrics', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(3);
      metrics.forEach((m) => {
        expect(m.value).toBe(1);
      });
    });
  });

  describe('recordScroll', () => {
    it('should record both scroll count and distance metrics', () => {
      collector.recordScroll(500, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics.map((m) => m.name)).toContain('vibe_kanban.scroll.count');
      expect(metrics.map((m) => m.name)).toContain('vibe_kanban.scroll.distance_px');
    });

    it('should record scroll count as counter with value 1', () => {
      collector.recordScroll(500, machineId);

      const metrics = collector.getMetrics();
      const countMetric = metrics.find((m) => m.name === 'vibe_kanban.scroll.count');
      expect(countMetric?.type).toBe('counter');
      expect(countMetric?.value).toBe(1);
    });

    it('should record scroll distance with correct value', () => {
      const distance = 1234;
      collector.recordScroll(distance, machineId);

      const metrics = collector.getMetrics();
      const distanceMetric = metrics.find((m) => m.name === 'vibe_kanban.scroll.distance_px');
      expect(distanceMetric?.type).toBe('counter');
      expect(distanceMetric?.value).toBe(distance);
    });

    it('should only include machine_id in attributes', () => {
      collector.recordScroll(500, machineId);

      const metrics = collector.getMetrics();
      metrics.forEach((m) => {
        expect(m.attributes).toEqual({ machine_id: machineId });
      });
    });
  });

  describe('recordViewDuration', () => {
    it('should record view duration for diffs view', () => {
      collector.recordViewDuration('diffs', 10000, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('vibe_kanban.view.duration_ms');
      expect(metrics[0].type).toBe('gauge');
      expect(metrics[0].value).toBe(10000);
    });

    it('should record view duration for preview view', () => {
      collector.recordViewDuration('preview', 5000, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes.view).toBe('preview');
    });

    it('should include view in attributes along with route attributes', () => {
      collector.recordViewDuration('diffs', 5000, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes).toMatchObject({
        machine_id: machineId,
        route_type: 'task_detail',
        project_id: testUUIDs.project1,
        task_id: testUUIDs.task1,
        view: 'diffs',
      });
    });
  });

  describe('recordCharactersTyped', () => {
    it('should record characters typed count', () => {
      collector.recordCharactersTyped(150, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('vibe_kanban.characters_typed.count');
      expect(metrics[0].type).toBe('counter');
      expect(metrics[0].value).toBe(150);
    });

    it('should include route attributes', () => {
      collector.recordCharactersTyped(100, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes).toMatchObject({
        machine_id: machineId,
        route_type: 'task_detail',
        project_id: testUUIDs.project1,
        task_id: testUUIDs.task1,
      });
    });
  });

  describe('recordMessageSent', () => {
    it('should record both message count and length metrics', () => {
      collector.recordMessageSent(256, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics.map((m) => m.name)).toContain('vibe_kanban.message_sent.count');
      expect(metrics.map((m) => m.name)).toContain('vibe_kanban.message_sent.length');
    });

    it('should record message count as counter with value 1', () => {
      collector.recordMessageSent(256, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      const countMetric = metrics.find((m) => m.name === 'vibe_kanban.message_sent.count');
      expect(countMetric?.type).toBe('counter');
      expect(countMetric?.value).toBe(1);
    });

    it('should record message length as gauge with correct value', () => {
      const messageLength = 1024;
      collector.recordMessageSent(messageLength, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      const lengthMetric = metrics.find((m) => m.name === 'vibe_kanban.message_sent.length');
      expect(lengthMetric?.type).toBe('gauge');
      expect(lengthMetric?.value).toBe(messageLength);
    });

    it('should include route attributes in both metrics', () => {
      collector.recordMessageSent(256, testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      metrics.forEach((m) => {
        expect(m.attributes).toMatchObject({
          machine_id: machineId,
          route_type: 'task_detail',
          project_id: testUUIDs.project1,
        });
      });
    });
  });

  describe('flush', () => {
    it('should return all metrics', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const flushed = collector.flush();

      expect(flushed).toHaveLength(2);
    });

    it('should clear the queue after flush', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      collector.flush();
      const afterFlush = collector.getMetrics();

      expect(afterFlush).toHaveLength(0);
    });

    it('should return empty array when no metrics', () => {
      const flushed = collector.flush();

      expect(flushed).toEqual([]);
    });

    it('should return metrics in order they were recorded', () => {
      vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      vi.advanceTimersByTime(1000);
      collector.recordScroll(500, machineId);

      const flushed = collector.flush();

      expect(flushed[0].name).toBe('vibe_kanban.human_intervention.count');
      expect(flushed[1].name).toBe('vibe_kanban.scroll.count');
    });
  });

  describe('getMetrics', () => {
    it('should return copy of metrics without clearing', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const firstGet = collector.getMetrics();
      const secondGet = collector.getMetrics();

      expect(firstGet).toHaveLength(1);
      expect(secondGet).toHaveLength(1);
    });

    it('should return a copy, not the original array', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);

      const metrics = collector.getMetrics();
      metrics.push({} as MetricRecord); // Modify returned array

      expect(collector.getMetrics()).toHaveLength(1); // Original unchanged
    });
  });

  describe('restore', () => {
    it('should prepend restored metrics to queue', () => {
      const oldMetrics: MetricRecord[] = [
        {
          name: 'old_metric',
          type: 'counter',
          value: 1,
          timestamp: Date.now() - 10000,
          attributes: { machine_id: machineId },
        },
      ];

      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      collector.restore(oldMetrics);

      const metrics = collector.getMetrics();
      expect(metrics[0].name).toBe('old_metric');
      expect(metrics[1].name).toBe('vibe_kanban.human_intervention.count');
    });

    it('should restore multiple metrics', () => {
      const oldMetrics: MetricRecord[] = [
        {
          name: 'old_metric_1',
          type: 'counter',
          value: 1,
          timestamp: Date.now(),
          attributes: {},
        },
        {
          name: 'old_metric_2',
          type: 'gauge',
          value: 2,
          timestamp: Date.now(),
          attributes: {},
        },
      ];

      collector.restore(oldMetrics);

      expect(collector.getMetrics()).toHaveLength(2);
    });

    it('should handle empty restore array', () => {
      collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      collector.restore([]);

      expect(collector.getMetrics()).toHaveLength(1);
    });
  });

  describe('Max Queue Size', () => {
    it('should enforce max queue size of 1000', () => {
      // Record 1001 metrics
      for (let i = 0; i < 1001; i++) {
        collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      }

      expect(collector.getMetrics()).toHaveLength(1000);
    });

    it('should drop oldest metrics when exceeding max size', () => {
      // Record first batch
      vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
      for (let i = 0; i < 500; i++) {
        collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      }

      // Record second batch with newer timestamp
      vi.advanceTimersByTime(10000);
      for (let i = 0; i < 600; i++) {
        collector.recordHumanIntervention(testRoutes.taskDetail, machineId);
      }

      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(1000);
      // Oldest metrics should be from the newer batch
      expect(metrics[0].timestamp).toBeGreaterThanOrEqual(Date.now() - 10000);
    });

    it('should trim restored metrics to max queue size', () => {
      const oldMetrics: MetricRecord[] = [];
      for (let i = 0; i < 1100; i++) {
        oldMetrics.push({
          name: `metric_${i}`,
          type: 'counter',
          value: i,
          timestamp: Date.now(),
          attributes: {},
        });
      }

      collector.restore(oldMetrics);

      expect(collector.getMetrics()).toHaveLength(1000);
    });
  });

  describe('Attribute Building', () => {
    it('should include workspace_id when present', () => {
      collector.recordActiveTime(5000, testRoutes.workspace, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes.workspace_id).toBe(testUUIDs.workspace1);
    });

    it('should NOT include project_id when not present', () => {
      collector.recordActiveTime(5000, testRoutes.workspace, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes.project_id).toBeUndefined();
    });

    it('should NOT include task_id when not present', () => {
      collector.recordActiveTime(5000, testRoutes.taskBoard, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes.task_id).toBeUndefined();
    });

    it('should handle unknown route type', () => {
      collector.recordActiveTime(5000, testRoutes.unknown, machineId);

      const metrics = collector.getMetrics();
      expect(metrics[0].attributes.route_type).toBe('unknown');
    });
  });

  describe('ProjectNameCache Integration', () => {
    it('should work without project name cache', () => {
      // Collector without cache should still work
      const collectorWithoutCache = new MetricsCollector();
      collectorWithoutCache.recordActiveTime(5000, testRoutes.taskDetail, machineId);

      const metrics = collectorWithoutCache.getMetrics();
      expect(metrics[0].attributes.project_name).toBeUndefined();
    });
  });
});
