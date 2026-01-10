/**
 * URL Parser for vibe-kanban routes
 * Extracts workspace, project, and task IDs from URL paths
 */

export interface ParsedRoute {
  type: 'workspace' | 'workspace_create' | 'task_board' | 'task_detail' | 'unknown';
  workspaceId?: string;
  projectId?: string;
  taskId?: string;
  view?: 'diffs' | 'preview' | null;
}

// UUID pattern for matching IDs in URLs
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

// Route patterns with named groups
const ROUTE_PATTERNS = {
  // /workspaces/create
  workspace_create: /^\/workspaces\/create\/?$/i,
  // /workspaces/:workspaceId
  workspace: new RegExp(`^/workspaces/(${UUID_PATTERN})/?$`, 'i'),
  // /projects/:projectId/tasks/:taskId
  task_detail: new RegExp(`^/projects/(${UUID_PATTERN})/tasks/(${UUID_PATTERN})/?$`, 'i'),
  // /projects/:projectId/tasks
  task_board: new RegExp(`^/projects/(${UUID_PATTERN})/tasks/?$`, 'i'),
};

/**
 * Parse vibe-kanban URL to extract route information
 * @param url - Full URL or pathname to parse
 * @returns ParsedRoute object with type and extracted IDs
 */
export function parseVibeKanbanUrl(url: string): ParsedRoute {
  let pathname: string;
  let searchParams: URLSearchParams;

  try {
    const urlObj = new URL(url, 'http://localhost');
    pathname = urlObj.pathname;
    searchParams = urlObj.searchParams;
  } catch {
    // If URL parsing fails, treat the input as a pathname
    pathname = url.split('?')[0];
    const queryString = url.split('?')[1] || '';
    searchParams = new URLSearchParams(queryString);
  }

  // Extract view modifier from query params
  const viewParam = searchParams.get('view');
  const view: 'diffs' | 'preview' | null =
    viewParam === 'diffs' ? 'diffs' :
    viewParam === 'preview' ? 'preview' :
    null;

  // Check workspace_create first (before workspace pattern)
  if (ROUTE_PATTERNS.workspace_create.test(pathname)) {
    return { type: 'workspace_create', view };
  }

  // Check workspace pattern
  const workspaceMatch = pathname.match(ROUTE_PATTERNS.workspace);
  if (workspaceMatch) {
    return {
      type: 'workspace',
      workspaceId: workspaceMatch[1],
      view,
    };
  }

  // Check task_detail pattern (before task_board)
  const taskDetailMatch = pathname.match(ROUTE_PATTERNS.task_detail);
  if (taskDetailMatch) {
    return {
      type: 'task_detail',
      projectId: taskDetailMatch[1],
      taskId: taskDetailMatch[2],
      view,
    };
  }

  // Check task_board pattern
  const taskBoardMatch = pathname.match(ROUTE_PATTERNS.task_board);
  if (taskBoardMatch) {
    return {
      type: 'task_board',
      projectId: taskBoardMatch[1],
      view,
    };
  }

  // Unknown route
  return { type: 'unknown', view };
}
