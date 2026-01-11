/**
 * Test fixtures for route objects
 * Provides commonly used route configurations for testing
 */

import type { ParsedRoute } from '../../src/content/url-parser';

export const testRoutes: Record<string, ParsedRoute> = {
  taskDetail: {
    type: 'task_detail',
    projectId: '11111111-1111-1111-1111-111111111111',
    taskId: '22222222-2222-2222-2222-222222222222',
    view: null,
  },

  taskDetailWithPreview: {
    type: 'task_detail',
    projectId: '11111111-1111-1111-1111-111111111111',
    taskId: '22222222-2222-2222-2222-222222222222',
    view: 'preview',
  },

  taskDetailWithDiffs: {
    type: 'task_detail',
    projectId: '11111111-1111-1111-1111-111111111111',
    taskId: '22222222-2222-2222-2222-222222222222',
    view: 'diffs',
  },

  taskBoard: {
    type: 'task_board',
    projectId: '11111111-1111-1111-1111-111111111111',
    view: null,
  },

  workspace: {
    type: 'workspace',
    workspaceId: '33333333-3333-3333-3333-333333333333',
    view: null,
  },

  workspaceCreate: {
    type: 'workspace_create',
    view: null,
  },

  unknown: {
    type: 'unknown',
    view: null,
  },
};

/**
 * Generate a unique route for testing
 */
export function createTestRoute(overrides: Partial<ParsedRoute> = {}): ParsedRoute {
  return {
    type: 'task_detail',
    projectId: `proj-${Date.now()}`,
    taskId: `task-${Date.now()}`,
    view: null,
    ...overrides,
  };
}

/**
 * Common test UUIDs
 */
export const testUUIDs = {
  project1: '11111111-1111-1111-1111-111111111111',
  project2: '44444444-4444-4444-4444-444444444444',
  task1: '22222222-2222-2222-2222-222222222222',
  task2: '55555555-5555-5555-5555-555555555555',
  workspace1: '33333333-3333-3333-3333-333333333333',
  attempt1: '66666666-6666-6666-6666-666666666666',
};
