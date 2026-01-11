/**
 * Unit tests for throttle function
 * Tests throttling behavior for event handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '../../../src/content/event-listeners';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Immediate Execution', () => {
    it('should call function immediately on first invocation', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled('arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('Throttling Behavior', () => {
    it('should NOT call function again within delay period', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow call after delay period expires', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();
      vi.advanceTimersByTime(1001);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should schedule trailing call at end of throttle period', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled(); // Immediate call
      vi.advanceTimersByTime(500);
      throttled(); // Should schedule trailing call

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500); // Complete the delay period

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use arguments from trailing call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled('first');
      vi.advanceTimersByTime(500);
      throttled('second'); // This will be the trailing call

      vi.advanceTimersByTime(500);

      expect(fn).toHaveBeenLastCalledWith('second');
    });
  });

  describe('Timing Precision', () => {
    it('should allow call exactly at delay boundary', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();
      vi.advanceTimersByTime(1000); // Exactly at boundary
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should NOT allow call one millisecond before delay', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();
      vi.advanceTimersByTime(999);
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should calculate correct remaining time for trailing call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled(); // t=0
      vi.advanceTimersByTime(700);
      throttled(); // t=700, should schedule for t=1000

      // At t=999, still shouldn't have called
      vi.advanceTimersByTime(299);
      expect(fn).toHaveBeenCalledTimes(1);

      // At t=1000, should call
      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple Trailing Calls', () => {
    it('should only schedule one trailing call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();
      vi.advanceTimersByTime(100);
      throttled();
      vi.advanceTimersByTime(100);
      throttled();
      vi.advanceTimersByTime(100);
      throttled();

      // Should have immediate call + scheduled trailing
      expect(fn).toHaveBeenCalledTimes(1);

      // Complete the period
      vi.advanceTimersByTime(700);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow new trailing call after previous completes', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      // First cycle
      throttled(); // t=0, immediate
      vi.advanceTimersByTime(500);
      throttled(); // t=500, schedule trailing
      vi.advanceTimersByTime(500); // t=1000, trailing fires

      expect(fn).toHaveBeenCalledTimes(2);

      // Second cycle
      vi.advanceTimersByTime(500);
      throttled(); // t=1500, schedule new trailing
      vi.advanceTimersByTime(500); // t=2000, trailing fires

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('Consecutive Periods', () => {
    it('should work correctly across multiple throttle periods', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      // Period 1
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      // Period 2
      vi.advanceTimersByTime(1000);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);

      // Period 3
      vi.advanceTimersByTime(1000);
      throttled();
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid calls across periods', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      for (let i = 0; i < 20; i++) {
        throttled();
        vi.advanceTimersByTime(50);
      }

      // With delay=100 and advancing by 50 each time over 20 iterations (1000ms total),
      // we expect calls at: 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000
      // Plus any trailing calls
      expect(fn.mock.calls.length).toBeGreaterThan(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero delay', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 0);

      throttled();
      throttled();
      throttled();

      // With 0 delay, all calls should go through
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle very long delays', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 60000); // 1 minute

      throttled();
      vi.advanceTimersByTime(59999);
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle no arguments', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 1000);

      throttled();

      expect(fn).toHaveBeenCalledWith();
    });
  });
});
