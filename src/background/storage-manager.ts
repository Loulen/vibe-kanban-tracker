/**
 * Storage Manager for vibe-kanban tracker
 * Persists configuration and pending metrics across browser restarts
 * using browser.storage.local API
 */

import browser from 'webextension-polyfill';
import type { MetricRecord } from './metrics-collector';
import { IDLE_TIMEOUT_MS, OTEL_ENDPOINT } from '../shared/constants';

export interface StoredConfig {
  machineId: string;
  idleTimeoutMs: number;
  otelEndpoint: string;
  enabled: boolean;
  sidebarOpen: boolean;
}

export interface StoredState {
  version: number;
  lastUpdated: number;
  config: StoredConfig;
  pendingMetrics: MetricRecord[];
}

const STORAGE_KEY = 'vibe_kanban_tracker';
const STORAGE_VERSION = 2;

export class StorageManager {
  private state: StoredState | null = null;

  /**
   * Load state from browser storage
   * Creates default state if none exists
   */
  async load(): Promise<StoredState> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      const storedData = result[STORAGE_KEY] as StoredState | undefined;

      if (!storedData) {
        // First run - create default state
        this.state = this.getDefaultState();
        await this.save();
        console.log('[vibe-tracker] Created default storage state');
        return this.state;
      }

      // Migrate if needed
      if (storedData.version < STORAGE_VERSION) {
        this.state = this.migrate(storedData);
        await this.save();
        console.log('[vibe-tracker] Migrated storage from version ' + storedData.version + ' to ' + STORAGE_VERSION);
      } else {
        this.state = storedData;
      }

      console.log('[vibe-tracker] Loaded storage state, pending metrics: ' + this.state.pendingMetrics.length);
      return this.state;
    } catch (error) {
      console.error('[vibe-tracker] Failed to load storage:', error);
      // Return default state on error
      this.state = this.getDefaultState();
      return this.state;
    }
  }

  /**
   * Save current state to browser storage
   */
  async save(): Promise<void> {
    if (!this.state) {
      throw new Error('Cannot save: state not loaded');
    }

    try {
      this.state.lastUpdated = Date.now();
      await browser.storage.local.set({ [STORAGE_KEY]: this.state });
    } catch (error) {
      console.error('[vibe-tracker] Failed to save storage:', error);
      throw error;
    }
  }

  /**
   * Update and save configuration
   */
  async saveConfig(config: Partial<StoredConfig>): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.config = {
      ...this.state!.config,
      ...config,
    };

    await this.save();
    console.log('[vibe-tracker] Saved config update:', Object.keys(config));
  }

  /**
   * Save pending metrics to storage
   * Called before export to ensure metrics survive browser restart
   */
  async savePendingMetrics(metrics: MetricRecord[]): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.pendingMetrics = metrics;
    await this.save();
  }

  /**
   * Get current configuration
   * Throws if state not loaded
   */
  getConfig(): StoredConfig {
    if (!this.state) {
      throw new Error('State not loaded. Call load() first.');
    }
    return { ...this.state.config };
  }

  /**
   * Get pending metrics that were not exported
   */
  getPendingMetrics(): MetricRecord[] {
    if (!this.state) {
      return [];
    }
    return [...this.state.pendingMetrics];
  }

  /**
   * Clear pending metrics after successful export
   */
  async clearPendingMetrics(): Promise<void> {
    if (!this.state) {
      return;
    }

    this.state.pendingMetrics = [];
    await this.save();
  }

  /**
   * Get default state for first run
   */
  private getDefaultState(): StoredState {
    return {
      version: STORAGE_VERSION,
      lastUpdated: Date.now(),
      config: {
        machineId: this.generateMachineId(),
        idleTimeoutMs: IDLE_TIMEOUT_MS,
        otelEndpoint: OTEL_ENDPOINT,
        enabled: true,
        sidebarOpen: false,
      },
      pendingMetrics: [],
    };
  }

  /**
   * Generate a unique machine ID using crypto.getRandomValues
   * Format: vibe-XXXX-XXXX-XXXX-XXXX (hex)
   */
  private generateMachineId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Format as vibe-XXXX-XXXX-XXXX-XXXX
    return 'vibe-' + hex.slice(0, 4) + '-' + hex.slice(4, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16);
  }

  /**
   * Migrate from older schema versions
   * Handles backwards compatibility for existing installations
   */
  private migrate(oldState: StoredState): StoredState {
    let state = { ...oldState };

    // V1 -> V2: Add sidebarOpen field with default value
    if (state.version < 2) {
      state.config = {
        ...state.config,
        sidebarOpen: false,
      };
      state.version = 2;
    }

    // Ensure version is current
    state.version = STORAGE_VERSION;

    return state;
  }
}
