/**
 * Integration tests for state change callback
 * Tests the interaction between StateMachine, MetricsCollector, and the callback logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine, type ActivityState, type StateContext } from '../../src/background/state-machine';
import { MetricsCollector } from '../../src/background/metrics-collector';
import type { ParsedRoute } from '../../src/content/url-parser';
import { testRoutes, testUUIDs } from '../fixtures/routes';

describe('State Callback Integration', () => {
  let stateMachine: StateMachine;
  let metricsCollector: MetricsCollector;
  let activeStateStartTime: number | null = null;
  let currentViewStartTime: number | null = null;
  let currentView: 'diffs' | 'preview' | null = null;
  const machineId = 'test-machine';
  const IDLE_TIMEOUT = 60000;

  /**
   * Replicate the full callback logic from index.ts
   * This tests the integration between state machine and metrics collector
   */
  function setupStateChangeCallback(): void {
    stateMachine.setOnStateChange(
      (prev: ActivityState, next: ActivityState, context: StateContext) => {
        // Record active time when leaving active state
        if (prev === 'active' && activeStateStartTime !== null) {
          const durationMs = Date.now() - activeStateStartTime;
          if (context.currentRoute) {
            metricsCollector.recordActiveTime(durationMs, context.currentRoute, machineId);
          }
          activeStateStartTime = null;
        }

        // Start tracking active time when entering active state
        if (next === 'active') {
          activeStateStartTime = Date.now();
        }

        // Record view duration when state changes
        if (currentViewStartTime !== null && currentView !== null && context.currentRoute) {
          const viewDurationMs = Date.now() - currentViewStartTime;
          metricsCollector.recordViewDuration(currentView, viewDurationMs, context.currentRoute, machineId);
          currentViewStartTime = null;
          currentView = null;
        }
      }
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
    stateMachine = new StateMachine(IDLE_TIMEOUT);
    metricsCollector = new MetricsCollector();
    activeStateStartTime = null;
    currentViewStartTime = null;
    currentView = null;
    setupStateChangeCallback();
  });

  afterEach(() => {
    stateMachine.stopIdleCheck();
    vi.useRealTimers();
  });

  describe('Active Time Recording', () => {
    it('should record active time when transitioning from active to unfocused', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });
      stateMachine.transition({ type: 'FOCUS' });

      vi.advanceTimersByTime(5000);

      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('vibe_kanban.active_time.duration_ms');
      expect(metrics[0].value).toBe(5000);
    });

    it('should record active time when transitioning from active to idle', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });
      stateMachine.transition({ type: 'FOCUS' });

      vi.advanceTimersByTime(IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(IDLE_TIMEOUT + 1000);
    });

    it('should record multiple active sessions', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });

      // Session 1
      stateMachine.transition({ type: 'FOCUS' });
      vi.advanceTimersByTime(3000);
      stateMachine.transition({ type: 'BLUR' });

      // Session 2
      vi.advanceTimersByTime(1000);
      stateMachine.transition({ type: 'FOCUS' });
      vi.advanceTimersByTime(2000);
      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(3000);
      expect(metrics[1].value).toBe(2000);
    });

    it('should include correct route attributes in metrics', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });
      stateMachine.transition({ type: 'FOCUS' });
      vi.advanceTimersByTime(1000);
      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics[0].attributes).toMatchObject({
        machine_id: machineId,
        route_type: 'task_detail',
        project_id: testUUIDs.project1,
        task_id: testUUIDs.task1,
      });
    });
  });

  describe('View Duration Recording', () => {
    it('should record view duration when state changes while in a view', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetailWithDiffs });
      stateMachine.transition({ type: 'FOCUS' });

      // Start tracking view
      currentView = 'diffs';
      currentViewStartTime = Date.now();

      vi.advanceTimersByTime(5000);

      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      // Should have active_time + view_duration
      expect(metrics).toHaveLength(2);

      const viewMetric = metrics.find((m) => m.name === 'vibe_kanban.view.duration_ms');
      expect(viewMetric).toBeDefined();
      expect(viewMetric?.value).toBe(5000);
      expect(viewMetric?.attributes.view).toBe('diffs');
    });

    it('should not record view duration if no view is active', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });
      stateMachine.transition({ type: 'FOCUS' });
      vi.advanceTimersByTime(5000);
      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      // Should only have active_time, no view_duration
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('vibe_kanban.active_time.duration_ms');
    });
  });

  describe('Idle Cycle Integration', () => {
    it('should record metrics for complete idle cycle', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });
      stateMachine.transition({ type: 'FOCUS' });

      // Active for 30 seconds
      vi.advanceTimersByTime(30000);

      // Go idle
      vi.advanceTimersByTime(IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' });

      // Return from idle
      stateMachine.transition({ type: 'ACTIVITY' });
      vi.advanceTimersByTime(10000);

      // Leave page
      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(2);

      // First period: 30s + 61s (until idle)
      expect(metrics[0].value).toBe(91000);

      // Second period: 10s (after returning from idle)
      expect(metrics[1].value).toBe(10000);
    });
  });

  describe('Route Changes During Active State', () => {
    it('should use current route at time of state transition', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskBoard });
      stateMachine.transition({ type: 'FOCUS' });

      vi.advanceTimersByTime(2000);

      // Navigate to different page
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });

      vi.advanceTimersByTime(3000);

      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      // Should use the route at time of blur (taskDetail)
      expect(metrics[0].attributes.route_type).toBe('task_detail');
      expect(metrics[0].attributes.task_id).toBe(testUUIDs.task1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle immediate blur after focus', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });
      stateMachine.transition({ type: 'FOCUS' });
      stateMachine.transition({ type: 'BLUR' }); // Immediate

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(0);
    });

    it('should not record metrics when route is null', () => {
      // No navigation, just focus/blur
      stateMachine.transition({ type: 'FOCUS' });
      vi.advanceTimersByTime(5000);
      stateMachine.transition({ type: 'BLUR' });

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(0);
    });

    it('should handle multiple rapid state changes', () => {
      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });

      // Rapid focus/blur cycle
      for (let i = 0; i < 10; i++) {
        stateMachine.transition({ type: 'FOCUS' });
        vi.advanceTimersByTime(100);
        stateMachine.transition({ type: 'BLUR' });
        vi.advanceTimersByTime(50);
      }

      const metrics = metricsCollector.getMetrics();
      expect(metrics).toHaveLength(10);
      metrics.forEach((m) => {
        expect(m.value).toBe(100);
      });
    });
  });
});
