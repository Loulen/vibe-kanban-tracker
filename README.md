# Vibe Kanban Tracker

A Firefox/Zen browser extension that tracks user activity on vibe-kanban and exports telemetry to OpenTelemetry for visualization in Grafana.

<img width="1001" height="1022" alt="image" src="https://github.com/user-attachments/assets/96342ca7-769f-4154-9b4f-41db156c2f3c" />


## Features

- **Active Tasks Sidebar**: Toggleable sidebar displaying all tasks with "In Progress" or "In Review" status across all projects, with click-to-navigate functionality
- **Activity Tracking**: Monitors active vs idle time while working in vibe-kanban
- **Human Intervention Detection**: Counts messages sent to Claude (clicks on send buttons)
- **Scroll Tracking**: Records scroll events and total scroll distance
- **View Duration**: Tracks time spent in diff and preview views
- **API-Based Metrics**: Polls vibe-kanban API for task counts, project stats, and age metrics
- **Project Name Resolution**: Enriches all metrics with human-readable project names
- **Multi-Machine Support**: Identifies metrics by machine for cross-computer comparison
- **Persistent Metrics**: Survives browser restarts with pending metric persistence
- **Configurable**: Options page for customizing behavior

## Installation

### Prerequisites

1. **OpenTelemetry Collector** running and accessible (default: `http://localhost:4318`)
2. **Grafana** for visualizing metrics (optional but recommended)
3. **Node.js** (v18 or later) for building the extension

### Build the Extension

```bash
cd vibe-kanban-tracker
npm install
npm run build
```

This creates a `dist/` directory with the compiled extension.

### Create Installable Package

After building, create a zip file for installation:

```bash
npm run package
```

This creates `vibe-kanban-tracker.zip` in the project root.

### Load in Firefox/Zen Browser

**Option 1: Load from zip file (Recommended)**

1. Open your browser and navigate to `about:addons`
2. Click the gear icon and select "Install Add-on From File..."
3. Select the `vibe-kanban-tracker.zip` file

**Option 2: Load from dist folder (Development)**

1. Open your browser and navigate to `about:debugging`
2. Click "This Firefox" (or "This Browser" in Zen)
3. Click "Load Temporary Add-on..."
4. Navigate to the `dist/` directory and select `manifest.json`

The extension icon should appear in your toolbar. The extension automatically activates on `http://localhost:3069/*` (vibe-kanban).

> ⚠️ **Important:** After installation, you must grant permissions for the extension to work. Go to `about:addons` → click on "Vibe Kanban Tracker" → **Permissions** tab → enable "Access your data for http://localhost:3069". See [Troubleshooting](#permissions-not-granted) for details.

## Active Tasks Sidebar

The extension provides a toggleable sidebar that displays all tasks with "In Progress" or "In Review" status from all projects.

### Features

- **Toggle Button**: A hamburger menu button appears in the vibe-kanban header (left of the logo)
- **Task List**: Shows task title, project name, and status badge for each active task
- **Status Colors**: Blue badge for "In Progress", orange badge for "In Review"
- **Click to Navigate**: Click any task card to navigate directly to that task's detail page
- **Lock Sidebar**: Lock button in the footer prevents the sidebar from closing when clicking outside
- **State Persistence**: Sidebar open/closed state and lock state persist across page refreshes
- **Auto-Refresh**: Task list automatically refreshes every 30 seconds
- **Last Updated**: Timestamp shows when tasks were last fetched

### Usage

1. Navigate to any page in vibe-kanban (`http://localhost:3069`)
2. Click the hamburger menu button (three horizontal lines) in the header
3. The sidebar slides in from the left showing all active tasks
4. Click any task to navigate to its detail page
5. Click the lock icon in the footer to prevent the sidebar from closing when clicking outside
6. Click the X button or toggle button to close the sidebar (works regardless of lock state)

### Permanent Installation (Recommended)

The methods above load the extension temporarily - it will be removed when the browser restarts. For a permanent installation that survives browser restarts:

1. **Sign the extension** using Mozilla's web-ext tool
2. **Install the signed .xpi** file

**Quick Start:**
```bash
# Set up credentials (one-time)
cp .env.local.example .env.local
# Edit .env.local with your Mozilla API credentials

# Sign the extension
export $(cat .env.local | xargs) && npm run sign

# Install the .xpi from web-ext-artifacts/
```

For detailed instructions including how to get Mozilla API credentials, see **[INSTALLATION.md](INSTALLATION.md)**.

## Configuration

Access the options page by clicking on the extension icon or right-clicking and selecting "Options".

### Settings

| Option | Description | Default |
|--------|-------------|---------|
| **Enable Tracking** | Toggle activity tracking on/off | Enabled |
| **Machine ID** | Friendly name for this computer (e.g., "work-laptop", "home-desktop") | `default-machine` |
| **Idle Timeout** | How long before the tracker considers you idle | 60 seconds |
| **OTel Endpoint** | OpenTelemetry collector OTLP/HTTP endpoint | `http://localhost:4318` |

### Test Connection

Click the "Test Connection" button to verify the OTel collector is reachable. A successful test indicates metrics can be exported.

### Debug Info

Expand the "Debug Info" section to see:
- Current configuration
- Activity state (active/idle/background)
- Pending metrics count
- Initialization status

## Metrics Reference

All metrics are prefixed with `vibe_kanban.` and exported to the OTel collector every 30 seconds.

### Event-Based Metrics (User Activity)

| Metric | Type | Description | Attributes |
|--------|------|-------------|------------|
| `vibe_kanban.active_time.duration_ms` | Gauge | Time spent actively working (ms) | `project_id`, `project_name`, `task_id`, `workspace_id`, `route_type`, `view`, `machine_id` |
| `vibe_kanban.human_intervention.count` | Counter | Messages sent to Claude | `project_id`, `project_name`, `task_id`, `workspace_id`, `route_type`, `view`, `machine_id` |
| `vibe_kanban.scroll.count` | Counter | Number of scroll events | `machine_id` |
| `vibe_kanban.scroll.distance_px` | Counter | Total scroll distance in pixels | `machine_id` |
| `vibe_kanban.view.duration_ms` | Gauge | Time spent in diff/preview views (ms) | `view`, `project_id`, `project_name`, `task_id`, `workspace_id`, `route_type`, `machine_id` |
| `vibe_kanban.characters_typed.count` | Counter | Characters typed in text inputs | `project_id`, `project_name`, `task_id`, `route_type`, `machine_id` |
| `vibe_kanban.message_sent.count` | Counter | Messages submitted | `project_id`, `project_name`, `task_id`, `route_type`, `machine_id` |
| `vibe_kanban.message_sent.length` | Gauge | Length of submitted message | `project_id`, `project_name`, `task_id`, `route_type`, `machine_id` |

### API-Based Metrics (Polled from vibe-kanban API)

| Metric | Type | Description | Attributes |
|--------|------|-------------|------------|
| `vibe_kanban.projects.count` | Gauge | Total number of projects | `machine_id` |
| `vibe_kanban.projects.age_hours` | Gauge | Age of project in hours | `project_id`, `project_name`, `machine_id` |
| `vibe_kanban.tasks.count` | Gauge | Task count per status | `project_id`, `project_name`, `status`, `machine_id` |
| `vibe_kanban.tasks.age_hours` | Gauge | Average task age per status (hours) | `project_id`, `project_name`, `status`, `machine_id` |
| `vibe_kanban.tasks.failed_attempts` | Gauge | Tasks with failed last attempt | `project_id`, `project_name`, `machine_id` |
| `vibe_kanban.tasks.active_attempts` | Gauge | Tasks with in-progress attempt | `project_id`, `project_name`, `machine_id` |

### Attribute Descriptions

- `machine_id`: The friendly name configured in settings
- `project_id`: The vibe-kanban project UUID
- `project_name`: Human-readable project name (e.g., "PDD-logging")
- `task_id`: The current task identifier
- `workspace_id`: The workspace identifier
- `route_type`: Type of route (e.g., "task_board", "task_detail", "workspace")
- `view`: The current view ("diffs" or "preview")
- `status`: Task status ("todo", "inprogress", "inreview", "done", "cancelled")

## Grafana Dashboard

If you're using the `claude-code-otel` stack, a Grafana dashboard is auto-provisioned with the following panels:

### Dashboard Panels

1. **Overview Stats**: Summary metrics including total active time, intervention count, and scroll activity
2. **Time Distribution**: Breakdown of time spent across different views and routes
3. **Activity Over Time**: Time series graphs showing activity patterns
4. **Activity Log**: Recent activity events with timestamps

### Machine Filter

Use the machine filter dropdown to:
- View metrics from a specific machine
- Compare activity across multiple computers
- Identify which machine was most active

## Troubleshooting

### Permissions not granted

After installing the extension, Firefox/Zen requires you to explicitly grant permissions:

1. Navigate to `about:addons` (or click the puzzle piece icon → "Manage Extensions")
2. Find **"Vibe Kanban Tracker"** in the list
3. Click on the extension to open its details
4. Go to the **Permissions** tab
5. Enable **"Access your data for http://localhost:3069"** (required for the extension to work)
6. Reload any open vibe-kanban tabs

**Note:** Without this permission, the extension cannot inject the sidebar or track activity on vibe-kanban pages. This is the most common issue when the extension appears installed but doesn't work.

### Extension not loading

1. Check the browser console (`Ctrl+Shift+J`) for error messages
2. Verify the extension is loaded in `about:debugging`
3. Ensure you're on `http://localhost:3069` (vibe-kanban)

### No metrics in Grafana

1. **Verify OTel collector is running**: Check that your collector is accessible at the configured endpoint
2. **Test the connection**: Use the "Test Connection" button in the options page
3. **Check pending metrics**: Look at the Debug Info section - if `pendingMetricsCount` is growing, exports are failing
4. **Check collector logs**: Look for errors in your OTel collector logs

### Metrics not updating

1. **Check if extension is enabled**: Ensure "Enable Tracking" is checked in options
2. **Verify the page**: The extension only tracks activity on `http://localhost:3069/*`
3. **Wait for export interval**: Metrics are exported every 30 seconds
4. **Check activity state**: If you're idle, no active time metrics will be recorded

### Connection test fails

1. **Check endpoint URL**: Ensure it includes the protocol (e.g., `http://localhost:4318`)
2. **Verify collector is running**: `curl http://localhost:4318/v1/metrics` should respond
3. **Check CORS settings**: The collector must accept requests from browser extensions

### Human interventions not counted

Human interventions are detected by monitoring clicks on elements that trigger Claude messages. Ensure you're clicking the actual send button rather than using keyboard shortcuts.

## Development

### Project Structure

```
vibe-kanban-tracker/
├── dist/                     # Built extension (after npm run build)
├── icons/                    # Extension icons (SVG)
├── src/
│   ├── background/           # Background script
│   │   ├── index.ts          # Main background orchestrator
│   │   ├── metrics-collector.ts  # Event-based metric aggregation
│   │   ├── api-client.ts     # HTTP client for vibe-kanban API
│   │   ├── api-metrics-collector.ts # API-based metrics (tasks, projects)
│   │   ├── project-name-cache.ts # Project ID to name cache
│   │   ├── otel-exporter.ts  # OTLP/HTTP export
│   │   ├── state-machine.ts  # Activity state management
│   │   └── storage-manager.ts # Config & metric persistence
│   ├── content/              # Content script
│   │   ├── index.ts          # Entry point
│   │   ├── event-listeners.ts # DOM event handling
│   │   ├── url-parser.ts     # URL route parsing
│   │   └── sidebar/          # Active tasks sidebar
│   │       ├── sidebar.ts    # Main sidebar component
│   │       ├── sidebar.css   # Sidebar styles
│   │       └── task-card.ts  # Task card component
│   ├── options/              # Options page
│   │   ├── options.html      # UI markup
│   │   ├── options.css       # Styles
│   │   └── options.ts        # Options logic
│   └── shared/               # Shared utilities
│       ├── types.ts          # TypeScript interfaces
│       ├── sidebar-messages.ts # Sidebar message types
│       └── constants.ts      # Configuration constants
├── manifest.json             # Extension manifest (MV3)
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── webpack.config.js         # Build config
```

### Build Commands

```bash
# Production build
npm run build

# Development build with watch mode
npm run dev
```

### Architecture

1. **Content Script**: Injected into vibe-kanban pages, monitors user activity (clicks, scrolls, focus/blur), parses URLs, and sends events to the background script
2. **Background Script**: Manages activity state machine, collects metrics, handles persistence, and exports to OTel collector
3. **Options Page**: Provides UI for configuration and debugging

### State Machine

The extension tracks activity using a state machine with three states:
- **Active**: User is actively working (mouse/keyboard activity detected)
- **Idle**: No activity for longer than the idle timeout
- **Background**: Browser tab is not focused

### Metric Export

Metrics are:
1. Collected in memory as events occur
2. Persisted to browser storage before export (crash safety)
3. Exported to OTel collector every 30 seconds
4. Cleared from storage on successful export
5. Retried with exponential backoff on failure

## License

Private - Internal use only
