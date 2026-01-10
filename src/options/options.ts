/**
 * Options page script for Vibe Kanban Tracker
 * Handles configuration UI and communication with background script
 */

import browser from 'webextension-polyfill';

console.log('[vibe-tracker-options] Options page loaded');

// Message types for options-background communication
interface GetConfigMessage {
  type: 'GET_CONFIG';
}

interface SaveConfigMessage {
  type: 'SAVE_CONFIG';
  config: Partial<StoredConfig>;
}

interface TestConnectionMessage {
  type: 'TEST_CONNECTION';
}

interface GetDebugInfoMessage {
  type: 'GET_DEBUG_INFO';
}

type OptionsMessage =
  | GetConfigMessage
  | SaveConfigMessage
  | TestConnectionMessage
  | GetDebugInfoMessage;

interface StoredConfig {
  machineId: string;
  idleTimeoutMs: number;
  otelEndpoint: string;
  enabled: boolean;
}

interface ConfigResponse {
  success: boolean;
  config?: StoredConfig;
  error?: string;
}

interface TestConnectionResponse {
  success: boolean;
  error?: string;
}

interface DebugInfoResponse {
  success: boolean;
  debugInfo?: {
    config: StoredConfig;
    state: unknown;
    pendingMetricsCount: number;
    isInitialized: boolean;
  };
  error?: string;
}

// DOM Elements
let enabledCheckbox: HTMLInputElement;
let machineIdInput: HTMLInputElement;
let idleTimeoutSlider: HTMLInputElement;
let idleTimeoutValue: HTMLSpanElement;
let otelEndpointInput: HTMLInputElement;
let testConnectionBtn: HTMLButtonElement;
let connectionStatus: HTMLSpanElement;
let debugInfoPre: HTMLPreElement;
let refreshDebugBtn: HTMLButtonElement;

// Debounce timer for saving
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the options page
 */
async function init(): Promise<void> {
  // Get DOM elements
  enabledCheckbox = document.getElementById('enabled') as HTMLInputElement;
  machineIdInput = document.getElementById('machineId') as HTMLInputElement;
  idleTimeoutSlider = document.getElementById('idleTimeout') as HTMLInputElement;
  idleTimeoutValue = document.getElementById('idleTimeoutValue') as HTMLSpanElement;
  otelEndpointInput = document.getElementById('otelEndpoint') as HTMLInputElement;
  testConnectionBtn = document.getElementById('testConnection') as HTMLButtonElement;
  connectionStatus = document.getElementById('connectionStatus') as HTMLSpanElement;
  debugInfoPre = document.getElementById('debugInfo') as HTMLPreElement;
  refreshDebugBtn = document.getElementById('refreshDebug') as HTMLButtonElement;

  // Set up event listeners
  setupEventListeners();

  // Load current config
  await loadConfig();

  // Load debug info
  await loadDebugInfo();
}

/**
 * Set up event listeners for form elements
 */
function setupEventListeners(): void {
  // Enabled checkbox - save immediately
  enabledCheckbox.addEventListener('change', () => {
    saveConfig({ enabled: enabledCheckbox.checked });
  });

  // Machine ID - debounced save
  machineIdInput.addEventListener('input', () => {
    debouncedSave({ machineId: machineIdInput.value });
  });

  // Idle timeout slider - save immediately + update label
  idleTimeoutSlider.addEventListener('input', () => {
    updateIdleTimeoutLabel();
    const idleTimeoutMs = parseInt(idleTimeoutSlider.value, 10) * 1000;
    saveConfig({ idleTimeoutMs });
  });

  // OTel endpoint - debounced save
  otelEndpointInput.addEventListener('input', () => {
    debouncedSave({ otelEndpoint: otelEndpointInput.value });
  });

  // Test connection button
  testConnectionBtn.addEventListener('click', testConnection);

  // Refresh debug button
  refreshDebugBtn.addEventListener('click', loadDebugInfo);
}

/**
 * Update the idle timeout label to show current value
 */
function updateIdleTimeoutLabel(): void {
  const seconds = parseInt(idleTimeoutSlider.value, 10);
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      idleTimeoutValue.textContent = `${minutes}min`;
    } else {
      idleTimeoutValue.textContent = `${minutes}min ${remainingSeconds}s`;
    }
  } else {
    idleTimeoutValue.textContent = `${seconds}s`;
  }
}

/**
 * Load current config from background script
 */
async function loadConfig(): Promise<void> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'GET_CONFIG',
    } as GetConfigMessage)) as ConfigResponse;

    if (response.success && response.config) {
      populateForm(response.config);
    } else {
      console.error('[vibe-tracker-options] Failed to load config:', response.error);
    }
  } catch (error) {
    console.error('[vibe-tracker-options] Error loading config:', error);
  }
}

/**
 * Populate form fields with config values
 */
function populateForm(config: StoredConfig): void {
  enabledCheckbox.checked = config.enabled;
  machineIdInput.value = config.machineId;
  otelEndpointInput.value = config.otelEndpoint;

  // Convert milliseconds to seconds for slider
  const idleTimeoutSeconds = Math.round(config.idleTimeoutMs / 1000);
  idleTimeoutSlider.value = String(idleTimeoutSeconds);
  updateIdleTimeoutLabel();
}

/**
 * Save config changes to background script
 */
async function saveConfig(config: Partial<StoredConfig>): Promise<void> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      config,
    } as SaveConfigMessage)) as ConfigResponse;

    if (response.success) {
      console.log('[vibe-tracker-options] Config saved:', Object.keys(config));
    } else {
      console.error('[vibe-tracker-options] Failed to save config:', response.error);
    }
  } catch (error) {
    console.error('[vibe-tracker-options] Error saving config:', error);
  }
}

/**
 * Debounced save - waits 300ms after last input before saving
 */
function debouncedSave(config: Partial<StoredConfig>): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  saveDebounceTimer = setTimeout(() => {
    saveConfig(config);
    saveDebounceTimer = null;
  }, 300);
}

/**
 * Test connection to OTel endpoint
 */
async function testConnection(): Promise<void> {
  // Update UI to show loading
  testConnectionBtn.disabled = true;
  connectionStatus.textContent = 'Testing...';
  connectionStatus.className = 'status-indicator loading';

  try {
    const response = (await browser.runtime.sendMessage({
      type: 'TEST_CONNECTION',
    } as TestConnectionMessage)) as TestConnectionResponse;

    if (response.success) {
      connectionStatus.textContent = 'Connected!';
      connectionStatus.className = 'status-indicator success';
    } else {
      connectionStatus.textContent = response.error || 'Connection failed';
      connectionStatus.className = 'status-indicator error';
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    connectionStatus.textContent = errorMessage;
    connectionStatus.className = 'status-indicator error';
  } finally {
    testConnectionBtn.disabled = false;
  }
}

/**
 * Load debug info from background script
 */
async function loadDebugInfo(): Promise<void> {
  try {
    const response = (await browser.runtime.sendMessage({
      type: 'GET_DEBUG_INFO',
    } as GetDebugInfoMessage)) as DebugInfoResponse;

    if (response.success && response.debugInfo) {
      debugInfoPre.textContent = JSON.stringify(response.debugInfo, null, 2);
    } else {
      debugInfoPre.textContent = 'Error: ' + (response.error || 'Failed to load debug info');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debugInfoPre.textContent = 'Error: ' + errorMessage;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
