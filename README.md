# Vibe Kanban Tracker

A Firefox/Zen browser extension that tracks user activity on vibe-kanban and exports telemetry to OpenTelemetry for visualization in Grafana.

## Features

- **Activity Tracking**: Monitors active vs idle time while working in vibe-kanban
- **Human Intervention Detection**: Counts messages sent to Claude (clicks on send buttons)
- **Scroll Tracking**: Records scroll events and total scroll distance
- **View Duration**: Tracks time spent in diff and preview views
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

### Load in Firefox/Zen Browser

1. Open your browser and navigate to `about:debugging`
2. Click "This Firefox" (or "This Browser" in Zen)
3. Click "Load Temporary Add-on..."
4. Navigate to the `dist/` directory and select `manifest.json`

The extension icon should appear in your toolbar. The extension automatically activates on `http://localhost:3069/*` (vibe-kanban).

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

| Metric | Type | Description | Attributes |
|--------|------|-------------|------------|
| `vibe_kanban.active_time.duration_ms` | Gauge | Time spent actively working (ms) | `project_id`, `task_id`, `workspace_id`, `route_type`, `view`, `machine_id` |
| `vibe_kanban.human_intervention.count` | Counter | Messages sent to Claude | `project_id`, `task_id`, `workspace_id`, `route_type`, `view`, `machine_id` |
| `vibe_kanban.scroll.count` | Counter | Number of scroll events | `machine_id` |
| `vibe_kanban.scroll.distance_px` | Counter | Total scroll distance in pixels | `machine_id` |
| `vibe_kanban.view.duration_ms` | Gauge | Time spent in diff/preview views (ms) | `view`, `project_id`, `task_id`, `workspace_id`, `route_type`, `machine_id` |

### Attribute Descriptions

- `machine_id`: The friendly name configured in settings
- `project_id`: The vibe-kanban project identifier
- `task_id`: The current task identifier
- `workspace_id`: The workspace identifier
- `route_type`: Type of route (e.g., "task", "project", "home")
- `view`: The current view ("diffs" or "preview")

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
│   │   ├── index.ts          # Main background logic
│   │   ├── metrics-collector.ts  # Metric aggregation
│   │   ├── otel-exporter.ts  # OTLP/HTTP export
│   │   ├── state-machine.ts  # Activity state management
│   │   └── storage-manager.ts # Config & metric persistence
│   ├── content/              # Content script
│   │   ├── index.ts          # Entry point
│   │   ├── event-listeners.ts # DOM event handling
│   │   └── url-parser.ts     # URL route parsing
│   ├── options/              # Options page
│   │   ├── options.html      # UI markup
│   │   ├── options.css       # Styles
│   │   └── options.ts        # Options logic
│   └── shared/               # Shared utilities
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
