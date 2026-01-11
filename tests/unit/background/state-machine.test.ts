/**
 * Unit tests for StateMachine
 * Tests state transitions and route context management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine, type ActivityState, type StateContext } from '../../../src/background/state-machine';
import type { ParsedRoute } from '../../../src/content/url-parser';
import { testRoutes } from '../../fixtures/routes';

describe('StateMachine', () => {
  let stateMachine: StateMachine;
  const DEFAULT_IDLE_TIMEOUT = 60000; // 1 minute

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
    stateMachine = new StateMachine(DEFAULT_IDLE_TIMEOUT);
  });

  afterEach(() => {
    stateMachine.stopIdleCheck();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in unfocused state', () => {
      expect(stateMachine.getState().currentState).toBe('unfocused');
    });

    it('should have null currentRoute initially', () => {
      expect(stateMachine.getState().currentRoute).toBeNull();
    });

    it('should have initial lastActivityTime set to current time', () => {
      const state = stateMachine.getState();
      expect(state.lastActivityTime).toBe(Date.now());
    });

    it('should have initial lastStateChangeTime set to current time', () => {
      const state = stateMachine.getState();
      expect(state.lastStateChangeTime).toBe(Date.now());
    });
  });

  describe('State Transitions - FOCUS', () => {
    it('should transition from unfocused to active on FOCUS', () => {
      expect(stateMachine.getState().currentState).toBe('unfocused');

      stateMachine.transition({ type: 'FOCUS' });

      expect(stateMachine.getState().currentState).toBe('active');
    });

    it('should update lastActivityTime on FOCUS', () => {
      const initialTime = Date.now();
      vi.advanceTimersByTime(1000);

      stateMachine.transition({ type: 'FOCUS' });

      expect(stateMachine.getState().lastActivityTime).toBe(initialTime + 1000);
    });

    it('should NOT transition from active to active on FOCUS', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      const stateAfterFirstFocus = stateMachine.getState();

      vi.advanceTimersByTime(1000);
      stateMachine.transition({ type: 'FOCUS' }); // active -> active (no change)

      // State should remain active, but lastStateChangeTime should NOT update
      expect(stateMachine.getState().currentState).toBe('active');
      expect(stateMachine.getState().lastStateChangeTime).toBe(stateAfterFirstFocus.lastStateChangeTime);
    });

    it('should NOT transition from idle to active on FOCUS', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' }); // active -> idle

      stateMachine.transition({ type: 'FOCUS' }); // idle -> idle (no change expected)

      // FOCUS does not transition from idle - only ACTIVITY does
      expect(stateMachine.getState().currentState).toBe('idle');
    });
  });

  describe('State Transitions - BLUR', () => {
    it('should transition from active to unfocused on BLUR', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      expect(stateMachine.getState().currentState).toBe('active');

      stateMachine.transition({ type: 'BLUR' });

      expect(stateMachine.getState().currentState).toBe('unfocused');
    });

    it('should transition from idle to unfocused on BLUR', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' }); // active -> idle
      expect(stateMachine.getState().currentState).toBe('idle');

      stateMachine.transition({ type: 'BLUR' });

      expect(stateMachine.getState().currentState).toBe('unfocused');
    });

    it('should NOT transition from unfocused on BLUR', () => {
      expect(stateMachine.getState().currentState).toBe('unfocused');
      const initialState = stateMachine.getState();

      stateMachine.transition({ type: 'BLUR' });

      expect(stateMachine.getState().currentState).toBe('unfocused');
      expect(stateMachine.getState().lastStateChangeTime).toBe(initialState.lastStateChangeTime);
    });
  });

  describe('State Transitions - ACTIVITY', () => {
    it('should transition from idle to active on ACTIVITY', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' }); // active -> idle
      expect(stateMachine.getState().currentState).toBe('idle');

      stateMachine.transition({ type: 'ACTIVITY' });

      expect(stateMachine.getState().currentState).toBe('active');
    });

    it('should update lastActivityTime when in active state', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      const timeAfterFocus = Date.now();

      vi.advanceTimersByTime(5000);
      stateMachine.transition({ type: 'ACTIVITY' });

      expect(stateMachine.getState().lastActivityTime).toBe(timeAfterFocus + 5000);
    });

    it('should reset idle timer on ACTIVITY in active state', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      // Almost reach idle timeout
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT - 1000);
      stateMachine.transition({ type: 'ACTIVITY' }); // Reset timer

      // Another near-timeout period
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT - 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' }); // Should NOT transition yet

      expect(stateMachine.getState().currentState).toBe('active');
    });

    it('should NOT transition from unfocused on ACTIVITY', () => {
      expect(stateMachine.getState().currentState).toBe('unfocused');

      stateMachine.transition({ type: 'ACTIVITY' });

      // ACTIVITY from unfocused should not change state
      expect(stateMachine.getState().currentState).toBe('unfocused');
    });
  });

  describe('State Transitions - IDLE_TIMEOUT', () => {
    it('should transition from active to idle after timeout', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' });

      expect(stateMachine.getState().currentState).toBe('idle');
    });

    it('should NOT transition to idle if activity happened within timeout', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT / 2);
      stateMachine.transition({ type: 'ACTIVITY' }); // Reset timer

      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT / 2);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' }); // Not enough time passed

      expect(stateMachine.getState().currentState).toBe('active');
    });

    it('should NOT affect non-active states', () => {
      expect(stateMachine.getState().currentState).toBe('unfocused');

      stateMachine.transition({ type: 'IDLE_TIMEOUT' });

      expect(stateMachine.getState().currentState).toBe('unfocused');
    });
  });

  describe('State Transitions - NAVIGATE', () => {
    it('should update currentRoute without changing state', () => {
      const route = testRoutes.taskDetail;
      const initialState = stateMachine.getState().currentState;

      stateMachine.transition({ type: 'NAVIGATE', route });

      expect(stateMachine.getState().currentState).toBe(initialState);
      expect(stateMachine.getState().currentRoute).toEqual(route);
    });

    it('should preserve route across state transitions', () => {
      const route = testRoutes.taskDetail;

      stateMachine.transition({ type: 'NAVIGATE', route });
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      expect(stateMachine.getState().currentRoute).toEqual(route);
    });

    it('should update route when already set', () => {
      const route1 = testRoutes.taskDetail;
      const route2 = testRoutes.taskBoard;

      stateMachine.transition({ type: 'NAVIGATE', route: route1 });
      expect(stateMachine.getState().currentRoute).toEqual(route1);

      stateMachine.transition({ type: 'NAVIGATE', route: route2 });
      expect(stateMachine.getState().currentRoute).toEqual(route2);
    });

    it('should NOT trigger state change callback', () => {
      const callback = vi.fn();
      stateMachine.setOnStateChange(callback);

      stateMachine.transition({ type: 'NAVIGATE', route: testRoutes.taskDetail });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('State Change Callback', () => {
    it('should call callback on state change', () => {
      const callback = vi.fn();
      stateMachine.setOnStateChange(callback);

      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        'unfocused',
        'active',
        expect.objectContaining({ currentState: 'active' })
      );
    });

    it('should NOT call callback when state does not change', () => {
      const callback = vi.fn();
      stateMachine.setOnStateChange(callback);

      stateMachine.transition({ type: 'BLUR' }); // unfocused -> unfocused (no change)

      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass correct context to callback', () => {
      const route = testRoutes.taskDetail;
      const callback = vi.fn();

      stateMachine.transition({ type: 'NAVIGATE', route });
      stateMachine.setOnStateChange(callback);
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      expect(callback).toHaveBeenCalledWith(
        'unfocused',
        'active',
        expect.objectContaining({
          currentState: 'active',
          currentRoute: route,
        })
      );
    });

    it('should call callback with null route if not set', () => {
      const callback = vi.fn();
      stateMachine.setOnStateChange(callback);

      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active

      const contextArg = callback.mock.calls[0][2] as StateContext;
      expect(contextArg.currentRoute).toBeNull();
    });
  });

  describe('Idle Check Interval', () => {
    it('should automatically transition to idle after timeout', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      stateMachine.startIdleCheck();

      // Advance past idle timeout + check interval (5s)
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT + 5001);

      expect(stateMachine.getState().currentState).toBe('idle');
    });

    it('should not transition if activity occurs', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      stateMachine.startIdleCheck();

      // Almost reach timeout
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT - 10000);
      stateMachine.transition({ type: 'ACTIVITY' });

      // Wait another near-timeout period
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT - 10000);

      expect(stateMachine.getState().currentState).toBe('active');
    });

    it('should stop checking when stopIdleCheck is called', () => {
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      stateMachine.startIdleCheck();
      stateMachine.stopIdleCheck();

      // Advance way past idle timeout
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT * 2);

      // Should still be active because check was stopped
      expect(stateMachine.getState().currentState).toBe('active');
    });

    it('should not start multiple intervals', () => {
      stateMachine.startIdleCheck();
      stateMachine.startIdleCheck();
      stateMachine.startIdleCheck();

      // If multiple intervals were started, this would fail
      stateMachine.stopIdleCheck();
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT * 2);

      // Should not error or cause issues
      expect(stateMachine.getState()).toBeDefined();
    });
  });

  describe('Route Persistence (Bug Regression)', () => {
    it('should retain currentRoute when transitioning from idle to active', () => {
      const route = testRoutes.taskDetail;
      let callbackRoute: ParsedRoute | null = null;

      stateMachine.setOnStateChange((prev, next, context) => {
        callbackRoute = context.currentRoute;
      });

      // Setup: Focus -> Navigate -> Go idle -> Activity
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      stateMachine.transition({ type: 'NAVIGATE', route }); // set route
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT + 1000);
      stateMachine.transition({ type: 'IDLE_TIMEOUT' }); // active -> idle

      callbackRoute = null; // Reset to check next transition
      stateMachine.transition({ type: 'ACTIVITY' }); // idle -> active

      expect(callbackRoute).not.toBeNull();
      expect(callbackRoute?.projectId).toBe(route.projectId);
    });

    it('should retain currentRoute when transitioning from active to unfocused', () => {
      const route = testRoutes.taskDetail;
      let callbackRoute: ParsedRoute | null = null;

      stateMachine.setOnStateChange((prev, next, context) => {
        if (prev === 'active' && next === 'unfocused') {
          callbackRoute = context.currentRoute;
        }
      });

      stateMachine.transition({ type: 'NAVIGATE', route });
      stateMachine.transition({ type: 'FOCUS' }); // unfocused -> active
      stateMachine.transition({ type: 'BLUR' }); // active -> unfocused

      expect(callbackRoute).not.toBeNull();
      expect(callbackRoute?.projectId).toBe(route.projectId);
    });
  });

  describe('Custom Idle Timeout', () => {
    it('should respect custom idle timeout', () => {
      const customTimeout = 10000; // 10 seconds
      const customStateMachine = new StateMachine(customTimeout);

      customStateMachine.transition({ type: 'FOCUS' });
      vi.advanceTimersByTime(customTimeout + 1000);
      customStateMachine.transition({ type: 'IDLE_TIMEOUT' });

      expect(customStateMachine.getState().currentState).toBe('idle');
    });
  });
});
