/**
 * Mock for fetch API
 * Provides configurable responses for API endpoints
 */

import { vi } from 'vitest';

export interface FetchMockConfig {
  projects?: Array<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    updated_at: string;
    has_in_progress_attempt?: boolean;
    last_attempt_failed?: boolean;
  }>;
  otelSuccess?: boolean;
}

const defaultConfig: FetchMockConfig = {
  projects: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Test Project',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ],
  tasks: [
    {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Test Task',
      status: 'inprogress',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      has_in_progress_attempt: true,
      last_attempt_failed: false,
    },
  ],
  otelSuccess: true,
};

export function createFetchMock(config: FetchMockConfig = {}): typeof fetch {
  const mergedConfig = { ...defaultConfig, ...config };

  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    // OTel metrics endpoint
    if (url.includes('/v1/metrics')) {
      if (mergedConfig.otelSuccess) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.reject(new Error('Network error'));
    }

    // Projects API
    if (url.includes('/api/projects') && !url.includes('tasks')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: mergedConfig.projects,
          }),
      });
    }

    // Tasks API
    if (url.includes('/api/tasks') || url.includes('/tasks?')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: mergedConfig.tasks,
          }),
      });
    }

    // Attempts API
    if (url.includes('/attempts')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                id: '33333333-3333-3333-3333-333333333333',
                status: 'running',
                created_at: '2025-01-01T00:00:00Z',
              },
            ],
          }),
      });
    }

    // Default: 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  }) as typeof fetch;
}

/**
 * Install fetch mock globally
 */
export function installFetchMock(config?: FetchMockConfig): void {
  globalThis.fetch = createFetchMock(config);
}

/**
 * Reset fetch to original implementation
 */
export function resetFetchMock(): void {
  vi.restoreAllMocks();
}
