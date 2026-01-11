/**
 * Unit tests for URL Parser
 * Tests route parsing from vibe-kanban URLs
 */

import { describe, it, expect } from 'vitest';
import { parseVibeKanbanUrl, type ParsedRoute } from '../../../src/content/url-parser';
import { testUUIDs } from '../../fixtures/routes';

describe('parseVibeKanbanUrl', () => {
  describe('Workspace Routes', () => {
    it('should parse workspace URL', () => {
      const url = `http://localhost:3069/workspaces/${testUUIDs.workspace1}`;
      const result = parseVibeKanbanUrl(url);

      expect(result).toEqual({
        type: 'workspace',
        workspaceId: testUUIDs.workspace1,
        view: null,
      });
    });

    it('should parse workspace URL with trailing slash', () => {
      const url = `http://localhost:3069/workspaces/${testUUIDs.workspace1}/`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace');
      expect(result.workspaceId).toBe(testUUIDs.workspace1);
    });

    it('should parse workspace_create URL', () => {
      const url = 'http://localhost:3069/workspaces/create';
      const result = parseVibeKanbanUrl(url);

      expect(result).toEqual({
        type: 'workspace_create',
        view: null,
      });
    });

    it('should parse workspace_create URL with trailing slash', () => {
      const url = 'http://localhost:3069/workspaces/create/';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace_create');
    });

    it('should be case-insensitive for workspace URLs', () => {
      const url = `http://localhost:3069/WORKSPACES/${testUUIDs.workspace1}`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace');
    });
  });

  describe('Task Board Routes', () => {
    it('should parse task_board URL', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks`;
      const result = parseVibeKanbanUrl(url);

      expect(result).toEqual({
        type: 'task_board',
        projectId: testUUIDs.project1,
        view: null,
      });
    });

    it('should parse task_board URL with trailing slash', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks/`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_board');
      expect(result.projectId).toBe(testUUIDs.project1);
    });
  });

  describe('Task Detail Routes', () => {
    it('should parse task_detail URL', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks/${testUUIDs.task1}`;
      const result = parseVibeKanbanUrl(url);

      expect(result).toEqual({
        type: 'task_detail',
        projectId: testUUIDs.project1,
        taskId: testUUIDs.task1,
        view: null,
      });
    });

    it('should parse task_detail URL with trailing slash', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks/${testUUIDs.task1}/`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_detail');
      expect(result.projectId).toBe(testUUIDs.project1);
      expect(result.taskId).toBe(testUUIDs.task1);
    });

    it('should parse task_detail URL with attempts suffix', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks/${testUUIDs.task1}/attempts/${testUUIDs.attempt1}`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_detail');
      expect(result.projectId).toBe(testUUIDs.project1);
      expect(result.taskId).toBe(testUUIDs.task1);
    });
  });

  describe('View Parameter', () => {
    it('should parse view=diffs query param', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks?view=diffs`;
      const result = parseVibeKanbanUrl(url);

      expect(result.view).toBe('diffs');
    });

    it('should parse view=preview query param', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks?view=preview`;
      const result = parseVibeKanbanUrl(url);

      expect(result.view).toBe('preview');
    });

    it('should return null for unknown view param', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks?view=unknown`;
      const result = parseVibeKanbanUrl(url);

      expect(result.view).toBeNull();
    });

    it('should return null when no view param present', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks`;
      const result = parseVibeKanbanUrl(url);

      expect(result.view).toBeNull();
    });

    it('should parse view param on task detail URL', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks/${testUUIDs.task1}?view=diffs`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_detail');
      expect(result.view).toBe('diffs');
    });

    it('should parse view param on workspace URL', () => {
      const url = `http://localhost:3069/workspaces/${testUUIDs.workspace1}?view=preview`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace');
      expect(result.view).toBe('preview');
    });
  });

  describe('Unknown Routes', () => {
    it('should return unknown for root URL', () => {
      const url = 'http://localhost:3069/';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('unknown');
    });

    it('should return unknown for settings URL', () => {
      const url = 'http://localhost:3069/settings';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('unknown');
    });

    it('should return unknown for unmatched path', () => {
      const url = 'http://localhost:3069/some/random/path';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('unknown');
    });

    it('should return unknown for invalid UUID in workspace URL', () => {
      const url = 'http://localhost:3069/workspaces/not-a-uuid';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('unknown');
    });

    it('should return unknown for invalid UUID in project URL', () => {
      const url = 'http://localhost:3069/projects/invalid/tasks';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('unknown');
    });

    it('should preserve view param even for unknown routes', () => {
      const url = 'http://localhost:3069/unknown/path?view=diffs';
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('unknown');
      expect(result.view).toBe('diffs');
    });
  });

  describe('UUID Pattern Matching', () => {
    it('should match valid UUID v4 format', () => {
      const validUUID = '12345678-1234-1234-1234-123456789012';
      const url = `http://localhost:3069/workspaces/${validUUID}`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace');
      expect(result.workspaceId).toBe(validUUID);
    });

    it('should match lowercase UUIDs', () => {
      const lowercaseUUID = 'abcdefab-abcd-abcd-abcd-abcdefabcdef';
      const url = `http://localhost:3069/workspaces/${lowercaseUUID}`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace');
      expect(result.workspaceId).toBe(lowercaseUUID);
    });

    it('should match mixed case UUIDs', () => {
      const mixedCaseUUID = 'AbCdEfAb-AbCd-AbCd-AbCd-AbCdEfAbCdEf';
      const url = `http://localhost:3069/workspaces/${mixedCaseUUID}`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('workspace');
    });

    it('should NOT match invalid UUID formats', () => {
      const invalidUUIDs = [
        '12345678123412341234123456789012', // No dashes
        '12345678-1234-1234-123456789012', // Missing segment
        '12345678-1234-1234-1234-12345678901', // Too short
        '12345678-1234-1234-1234-1234567890123', // Too long
        'gggggggg-gggg-gggg-gggg-gggggggggggg', // Invalid hex
      ];

      for (const uuid of invalidUUIDs) {
        const url = `http://localhost:3069/workspaces/${uuid}`;
        const result = parseVibeKanbanUrl(url);
        expect(result.type).toBe('unknown');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle pathname-only input', () => {
      const pathname = `/projects/${testUUIDs.project1}/tasks/${testUUIDs.task1}`;
      const result = parseVibeKanbanUrl(pathname);

      expect(result.type).toBe('task_detail');
      expect(result.projectId).toBe(testUUIDs.project1);
      expect(result.taskId).toBe(testUUIDs.task1);
    });

    it('should handle pathname with query string', () => {
      const pathname = `/projects/${testUUIDs.project1}/tasks?view=diffs`;
      const result = parseVibeKanbanUrl(pathname);

      expect(result.type).toBe('task_board');
      expect(result.view).toBe('diffs');
    });

    it('should handle different hosts', () => {
      const url = `https://vibe-kanban.example.com/projects/${testUUIDs.project1}/tasks`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_board');
      expect(result.projectId).toBe(testUUIDs.project1);
    });

    it('should handle URL with port number', () => {
      const url = `http://localhost:8080/projects/${testUUIDs.project1}/tasks`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_board');
    });

    it('should handle URL with multiple query params', () => {
      const url = `http://localhost:3069/projects/${testUUIDs.project1}/tasks?view=diffs&other=param`;
      const result = parseVibeKanbanUrl(url);

      expect(result.type).toBe('task_board');
      expect(result.view).toBe('diffs');
    });

    it('should handle empty string input', () => {
      const result = parseVibeKanbanUrl('');

      expect(result.type).toBe('unknown');
    });
  });
});
