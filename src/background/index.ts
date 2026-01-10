/**
 * Background script for vibe-kanban tracker
 * Handles messages from content script and manages activity state
 */

import browser from 'webextension-polyfill';
import { StateMachine, type ActivityState, type StateContext } from './state-machine';
import { MetricsCollector } from './metrics-collector';
import { OTelExporter } from './otel-exporter';
import { StorageManager } from './storage-manager';
import { EXPORT_INTERVAL_MS } from '../shared/constants';
import type { ContentMessage, ScrollMessage, HumanInterventionMessage, TypingMessage, MessageSentMessage } from '../shared/types';

console.log('[vibe-tracker] Background script loaded');

// Initialize storage manager
const storageManager = new StorageManager();

// These will be initialized after storage loads
let stateMachine: StateMachine;
let metricsCollector: MetricsCollector;
let otelExporter: OTelExporter;
let machineId = 'unknown-machine';
let isInitialized = false;

/**
 * Initialize all components after loading from storage
 */
async function initialize(): Promise<void> {
  try {
    // Load persisted state
    const storedState = await storageManager.load();
    const config = storageManager.getConfig();

    machineId = config.machineId;

    // Initialize state machine with persisted idle timeout
    stateMachine = new StateMachine(config.idleTimeoutMs);

    // Initialize metrics collector
    metricsCollector = new MetricsCollector();

    // Restore pending metrics from storage
    const pendingMetrics = storageManager.getPendingMetrics();
    if (pendingMetrics.length > 0) {
      metricsCollector.restore(pendingMetrics);
      console.log('[vibe-tracker] Restored ' + pendingMetrics.length + ' pending metrics');
    }

    // Initialize OTel exporter with persisted config
    otelExporter = new OTelExporter({
      endpoint: config.otelEndpoint,
      serviceName: 'vibe-kanban-tracker',
      serviceVersion: '1.0.0',
      machineId: config.machineId,
    });

    // Set up state change callback
    setupStateChangeCallback();

    // Start idle check interval
    stateMachine.startIdleCheck();

    // Start export interval
    setInterval(exportMetrics, EXPORT_INTERVAL_MS);

    isInitialized = true;
    console.log('[vibe-tracker] Initialization complete, machineId: ' + machineId);
  } catch (error) {
    console.error('[vibe-tracker] Initialization failed:', error);
  }
}

// Track active time for duration calculations
let activeStateStartTime: number | null = null;
let currentViewStartTime: number | null = null;
let currentView: 'diffs' | 'preview' | null = null;

/**
 * Set up state change callback for debugging and metrics collection
 */
function setupStateChangeCallback(): void {
  stateMachine.setOnStateChange(
    (prev: ActivityState, next: ActivityState, context: StateContext) => {
      console.log('[vibe-tracker] State change:', {
        from: prev,
        to: next,
        route: context.currentRoute?.type,
        timestamp: new Date(context.lastStateChangeTime).toISOString(),
      });

      // Record active time when leaving active state
      if (prev === 'active' && activeStateStartTime !== null) {
        const durationMs = Date.now() - activeStateStartTime;
        console.log('[vibe-tracker] Recording active time:', { durationMs, hasRoute: !!context.currentRoute, routeType: context.currentRoute?.type });
        if (context.currentRoute) {
          metricsCollector.recordActiveTime(durationMs, context.currentRoute, machineId);
        } else {
          console.warn('[vibe-tracker] No currentRoute, skipping active time metric');
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

// Options page message types
interface OptionsMessage {
  type: 'GET_CONFIG' | 'SAVE_CONFIG' | 'TEST_CONNECTION' | 'GET_DEBUG_INFO';
  config?: Partial<{
    machineId: string;
    idleTimeoutMs: number;
    otelEndpoint: string;
    enabled: boolean;
  }>;
}

/**
 * Handle GET_CONFIG message from options page
 */
async function handleGetConfig(): Promise<{
  success: boolean;
  config?: ReturnType<typeof storageManager.getConfig>;
  error?: string;
}> {
  try {
    // Ensure storage is loaded before getting config
    await storageManager.load();
    const config = storageManager.getConfig();
    return { success: true, config };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle SAVE_CONFIG message from options page
 */
async function handleSaveConfig(
  config: OptionsMessage['config']
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config) {
      return { success: false, error: 'No config provided' };
    }

    await storageManager.saveConfig(config);

    // Update runtime state if machineId changed
    if (config.machineId) {
      machineId = config.machineId;
      otelExporter.setMachineId(config.machineId);
    }

    console.log('[vibe-tracker] Config updated from options:', Object.keys(config));
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle TEST_CONNECTION message from options page
 */
async function handleTestConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Ensure storage is loaded before getting config
    await storageManager.load();
    const config = storageManager.getConfig();
    const endpoint = config.otelEndpoint;

    // Send a test request to the OTel endpoint
    // We'll try to POST to /v1/metrics with an empty payload
    const response = await fetch(endpoint + '/v1/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resourceMetrics: [] }),
    });

    // OTel collector typically returns 200 for valid requests
    // Even with empty payload, a reachable endpoint should respond
    if (response.ok || response.status === 400) {
      // 400 might occur for empty payload but still means endpoint is reachable
      return { success: true };
    }

    return {
      success: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // Provide more user-friendly error messages
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      return {
        success: false,
        error: 'Cannot reach endpoint. Is the OTel collector running?',
      };
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Handle GET_DEBUG_INFO message from options page
 */
async function handleGetDebugInfo(): Promise<{
  success: boolean;
  debugInfo?: {
    config: ReturnType<typeof storageManager.getConfig>;
    state: ReturnType<typeof stateMachine.getState> | null;
    pendingMetricsCount: number;
    isInitialized: boolean;
  };
  error?: string;
}> {
  try {
    // Ensure storage is loaded before getting config
    await storageManager.load();
    const config = storageManager.getConfig();
    const state = isInitialized ? stateMachine.getState() : null;
    const pendingMetricsCount = storageManager.getPendingMetrics().length;

    return {
      success: true,
      debugInfo: {
        config,
        state,
        pendingMetricsCount,
        isInitialized,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Handle messages from content script and options page
browser.runtime.onMessage.addListener(
  (message: ContentMessage | OptionsMessage, sender: browser.Runtime.MessageSender) => {
    console.log('[vibe-tracker] Raw message received:', message.type, 'from:', sender.tab?.url || 'options/popup');

    // Handle options page messages (don't require full initialization)
    if ('type' in message) {
      switch (message.type) {
        case 'GET_CONFIG':
          return handleGetConfig();

        case 'SAVE_CONFIG':
          return handleSaveConfig((message as OptionsMessage).config);

        case 'TEST_CONNECTION':
          return handleTestConnection();

        case 'GET_DEBUG_INFO':
          return handleGetDebugInfo();
      }
    }

    // Content script messages require initialization
    if (!isInitialized) {
      console.log('[vibe-tracker] Message received before initialization, ignoring');
      return Promise.resolve({ received: false, error: 'not_initialized' });
    }

    console.log('[vibe-tracker] Processing content message:', {
      type: message.type,
      from: sender.tab?.url,
    });

    switch (message.type) {
      case 'FOCUS':
        stateMachine.transition({ type: 'FOCUS' });
        // Update route context if provided
        if ((message as ContentMessage).payload?.route) {
          stateMachine.transition({ type: 'NAVIGATE', route: (message as ContentMessage).payload.route });
        }
        break;

      case 'BLUR':
        stateMachine.transition({ type: 'BLUR' });
        break;

      case 'ACTIVITY':
        // Any user activity resets the idle timer
        stateMachine.transition({ type: 'ACTIVITY' });
        // Update route context if provided
        if ((message as ContentMessage).payload?.route) {
          stateMachine.transition({ type: 'NAVIGATE', route: (message as ContentMessage).payload.route });
        }
        break;

      case 'SCROLL':
        // Any user activity resets the idle timer
        stateMachine.transition({ type: 'ACTIVITY' });
        // Update route context if provided
        if ((message as ContentMessage).payload?.route) {
          stateMachine.transition({ type: 'NAVIGATE', route: (message as ContentMessage).payload.route });
        }
        // Record scroll metric
        {
          const scrollMsg = message as ScrollMessage;
          const scrollDistance = Math.abs(scrollMsg.payload.scrollPosition || 0);
          metricsCollector.recordScroll(scrollDistance, machineId);
        }
        break;

      case 'NAVIGATION':
        // Route change - update current route
        if ((message as ContentMessage).payload?.route) {
          // Record previous view duration before changing routes
          if (currentViewStartTime !== null && currentView !== null) {
            const stateContext = stateMachine.getState();
            if (stateContext.currentRoute) {
              const viewDurationMs = Date.now() - currentViewStartTime;
              metricsCollector.recordViewDuration(currentView, viewDurationMs, stateContext.currentRoute, machineId);
            }
          }

          stateMachine.transition({ type: 'NAVIGATE', route: (message as ContentMessage).payload.route });

          // Track new view if present
          const newView = (message as ContentMessage).payload.route.view;
          if (newView === 'diffs' || newView === 'preview') {
            currentView = newView;
            currentViewStartTime = Date.now();
          } else {
            currentView = null;
            currentViewStartTime = null;
          }
        }
        break;

      case 'HUMAN_INTERVENTION':
        // Human intervention counts as activity
        stateMachine.transition({ type: 'ACTIVITY' });
        {
          const hiMsg = message as HumanInterventionMessage;
          // Update route context if provided
          if (hiMsg.payload?.route) {
            stateMachine.transition({ type: 'NAVIGATE', route: hiMsg.payload.route });
            // Record human intervention metric
            metricsCollector.recordHumanIntervention(hiMsg.payload.route, machineId);
          }
          console.log('[vibe-tracker] Human intervention detected:', {
            triggerType: hiMsg.payload.triggerType,
            buttonText: hiMsg.payload.buttonText,
          });
        }
        break;

      case 'TYPING':
        // Typing counts as activity
        stateMachine.transition({ type: 'ACTIVITY' });
        {
          const typingMsg = message as TypingMessage;
          if (typingMsg.payload?.route) {
            stateMachine.transition({ type: 'NAVIGATE', route: typingMsg.payload.route });
            // Record characters typed metric
            metricsCollector.recordCharactersTyped(typingMsg.payload.characterCount, typingMsg.payload.route, machineId);
          }
          console.log('[vibe-tracker] Characters typed:', typingMsg.payload.characterCount);
        }
        break;

      case 'MESSAGE_SENT':
        // Message sent counts as activity
        stateMachine.transition({ type: 'ACTIVITY' });
        {
          const msMsg = message as MessageSentMessage;
          if (msMsg.payload?.route) {
            stateMachine.transition({ type: 'NAVIGATE', route: msMsg.payload.route });
            // Record message sent metric with length
            metricsCollector.recordMessageSent(msMsg.payload.messageLength, msMsg.payload.route, machineId);
          }
          console.log('[vibe-tracker] Message sent, length:', msMsg.payload.messageLength);
        }
        break;
    }

    return Promise.resolve({ received: true, state: stateMachine.getState() });
  }
);

/**
 * Export metrics with persistence
 * Saves metrics to storage before export to survive browser restart
 * Clears from storage after successful export
 */
async function exportMetrics(): Promise<void> {
  if (!isInitialized) {
    console.log('[vibe-tracker] Export skipped - not initialized');
    return;
  }

  const metrics = metricsCollector.flush();
  if (metrics.length === 0) {
    console.log('[vibe-tracker] Export cycle - no metrics to export');
    // Clear any pending metrics in storage
    await storageManager.clearPendingMetrics();
    return;
  }

  // Save to storage before export attempt (survives browser crash/restart)
  await storageManager.savePendingMetrics(metrics);

  console.log('[vibe-tracker] Exporting ' + metrics.length + ' metrics');

  const success = await otelExporter.export(metrics);
  if (success) {
    // Clear pending metrics from storage on success
    await storageManager.clearPendingMetrics();
  } else {
    // Restore metrics to collector for next export attempt
    console.warn('[vibe-tracker] Export failed, restoring metrics for retry');
    metricsCollector.restore(metrics);
  }
}

// Start initialization
initialize();

// Export for potential testing
export { stateMachine, metricsCollector, otelExporter, storageManager };
