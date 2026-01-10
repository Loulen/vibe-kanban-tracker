/**
 * Activity state machine for tracking user state
 * States: active, idle, unfocused
 * Handles transitions based on focus, blur, activity, and idle timeout events
 */

import type { ParsedRoute } from '../content/url-parser';

export type ActivityState = 'active' | 'idle' | 'unfocused';

export interface StateContext {
  currentState: ActivityState;
  lastActivityTime: number;
  lastStateChangeTime: number;
  currentRoute: ParsedRoute | null;
}

export type StateEvent =
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'ACTIVITY' }
  | { type: 'IDLE_TIMEOUT' }
  | { type: 'NAVIGATE'; route: ParsedRoute };

// Idle check interval: 5 seconds
const IDLE_CHECK_INTERVAL_MS = 5000;

export class StateMachine {
  private state: StateContext;
  private idleTimeoutMs: number;
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private onStateChange?: (
    prev: ActivityState,
    next: ActivityState,
    context: StateContext
  ) => void;

  constructor(idleTimeoutMs: number = 60000) {
    this.idleTimeoutMs = idleTimeoutMs;
    this.state = {
      currentState: 'unfocused',
      lastActivityTime: Date.now(),
      lastStateChangeTime: Date.now(),
      currentRoute: null,
    };
  }

  /**
   * Process a state event and transition to the appropriate state
   */
  transition(event: StateEvent): void {
    const prevState = this.state.currentState;
    let nextState = prevState;

    switch (event.type) {
      case 'FOCUS':
        // UNFOCUSED -> ACTIVE
        if (prevState === 'unfocused') {
          nextState = 'active';
          this.state.lastActivityTime = Date.now();
        }
        break;

      case 'BLUR':
        // ACTIVE -> UNFOCUSED or IDLE -> UNFOCUSED
        if (prevState === 'active' || prevState === 'idle') {
          nextState = 'unfocused';
        }
        break;

      case 'ACTIVITY':
        // IDLE -> ACTIVE
        if (prevState === 'idle') {
          nextState = 'active';
        }
        // Reset idle timer when in ACTIVE state
        if (prevState === 'active' || nextState === 'active') {
          this.state.lastActivityTime = Date.now();
        }
        break;

      case 'IDLE_TIMEOUT':
        // ACTIVE -> IDLE (only if no activity for idleTimeoutMs)
        if (prevState === 'active') {
          const timeSinceActivity = Date.now() - this.state.lastActivityTime;
          if (timeSinceActivity >= this.idleTimeoutMs) {
            nextState = 'idle';
          }
        }
        break;

      case 'NAVIGATE':
        // Update route context without changing state
        this.state.currentRoute = event.route;
        break;
    }

    // If state changed, update context and call callback
    if (nextState !== prevState) {
      this.state.currentState = nextState;
      this.state.lastStateChangeTime = Date.now();

      if (this.onStateChange) {
        this.onStateChange(prevState, nextState, { ...this.state });
      }
    }
  }

  /**
   * Get current state context
   */
  getState(): StateContext {
    return { ...this.state };
  }

  /**
   * Start the idle check interval
   * Checks every 5 seconds if idle threshold has been reached
   */
  startIdleCheck(): void {
    if (this.idleCheckInterval) {
      return; // Already running
    }

    this.idleCheckInterval = setInterval(() => {
      // Only check for idle timeout when in active state
      if (this.state.currentState === 'active') {
        const timeSinceActivity = Date.now() - this.state.lastActivityTime;
        if (timeSinceActivity >= this.idleTimeoutMs) {
          this.transition({ type: 'IDLE_TIMEOUT' });
        }
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  /**
   * Stop the idle check interval
   */
  stopIdleCheck(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  /**
   * Set callback for state changes
   */
  setOnStateChange(
    callback: (
      prev: ActivityState,
      next: ActivityState,
      context: StateContext
    ) => void
  ): void {
    this.onStateChange = callback;
  }
}
