# Testing Strategy - Vibe Kanban Tracker Extension

This document defines the testing strategy for the vibe-kanban-tracker browser extension. It focuses on **when** to use each test type and emphasizes an **automation-first** approach.

---

## 1. Testing Pyramid & Decision Matrix

### Test Layer Overview

| Layer | Test Type | Tools | When to Use | Coverage Target |
|-------|-----------|-------|-------------|-----------------|
| Base | Unit Tests | Vitest + JSDOM | Isolated logic, state machines, parsers, utility functions | 80%+ |
| Middle | Integration Tests | Vitest + JSDOM | Component interactions, message passing, callback chains | 50%+ |
| Top | E2E Tests | Playwright + Firefox | Full user flows, real browser behavior, extension loading | Critical paths only |

### Decision Matrix: Choosing the Right Test Type

| Scenario | Test Type | Rationale |
|----------|-----------|-----------|
| Pure function with inputs/outputs | Unit | Isolated, fast, deterministic |
| State machine transitions | Unit | Logic can be tested without dependencies |
| URL parsing logic | Unit | String manipulation, no external deps |
| Throttle/debounce behavior | Unit | Time-based logic with fake timers |
| State machine + metrics collector | Integration | Tests callback wiring between modules |
| Message passing between content/background scripts | Integration | Tests communication protocol |
| Full extension in real browser | E2E | Tests actual browser APIs |
| Sidebar toggle in real page | E2E | Tests DOM manipulation in real context |
| API export to OTel collector | E2E | Tests network behavior |

### Key Decision Criteria

1. **Can this logic be tested in isolation?** -> Unit test
2. **Does it involve multiple modules communicating?** -> Integration test
3. **Does it require a real browser or real network?** -> E2E test
4. **Is it a critical user-facing flow?** -> E2E test (in addition to unit/integration)

---

## 2. Test Development Workflow

### Step-by-Step Process

1. **Identify test type** using the decision matrix above
2. **Create test file** with correct naming convention:
   - Unit/Integration: `*.test.ts`
   - E2E: `*.spec.ts`
3. **Follow Arrange-Act-Assert** pattern consistently
4. **Use fake timers** for all time-based logic
5. **Mock browser APIs** using provided mocks for unit/integration tests

### File Structure

```
tests/
  unit/
    background/
      state-machine.test.ts
      metrics-collector.test.ts
    content/
      url-parser.test.ts
      throttle.test.ts
  integration/
    state-callback.test.ts
    export-cycle.test.ts
  e2e/
    full-flow.spec.ts
    activity-metrics.spec.ts
    fixtures.ts
  mocks/
    browser-mock.ts
    fetch-mock.ts
  fixtures/
    routes.ts
  setup.ts
```

### Test File Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Unit | `tests/unit/<module>/<filename>.test.ts` | `tests/unit/background/state-machine.test.ts` |
| Integration | `tests/integration/<scenario>.test.ts` | `tests/integration/state-callback.test.ts` |
| E2E | `tests/e2e/<flow>.spec.ts` | `tests/e2e/full-flow.spec.ts` |

### Arrange-Act-Assert Pattern

```typescript
describe('StateMachine', () => {
  it('should transition from unfocused to active on FOCUS', () => {
    // Arrange
    const stateMachine = new StateMachine(60000);
    expect(stateMachine.getState().currentState).toBe('unfocused');

    // Act
    stateMachine.transition({ type: 'FOCUS' });

    // Assert
    expect(stateMachine.getState().currentState).toBe('active');
  });
});
```

### Fake Timers for Time-Based Logic

Always use fake timers when testing:
- Idle timeout detection
- Throttled event handlers
- Export intervals
- Debounced operations

```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('should transition to idle after timeout', () => {
  stateMachine.transition({ type: 'FOCUS' });
  
  vi.advanceTimersByTime(IDLE_TIMEOUT + 1000);
  stateMachine.transition({ type: 'IDLE_TIMEOUT' });
  
  expect(stateMachine.getState().currentState).toBe('idle');
});
```

---

## 3. Automation Strategy

### 3.1 Agent-Driven Testing (TPM Workflow)

**Pre-commit Checklist for Agents (adept-coder, senior-coder):**

- [ ] Run `npm run test:unit` - **MUST pass**
- [ ] Run `npm run test:integration` - **MUST pass**
- [ ] Run `npm run test:e2e` - If modifying content scripts or background scripts
- [ ] Add tests for new code (unit tests for logic, integration for interactions)
- [ ] Add regression tests for bug fixes

**Agent Testing Protocol:**

1. **Before implementing:** Read existing tests in the affected module
2. **During implementation:** Write tests alongside code (TDD when appropriate)
3. **After implementation:** Run full test suite relevant to changes
4. **Before staging:** Verify all tests pass

**Commands for Agents:**

```bash
# Run unit tests only (fast feedback)
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests (requires vibe-kanban running)
npm run test:e2e

# Run all tests
npm run test:all

# Run tests with coverage report
npm run test:coverage
```

### 3.2 MCP Server Automation

#### Playwright MCP - For Automated E2E Browser Testing

The Playwright MCP server provides tools for automated browser interaction during testing and debugging.

**Available Tools:**

| Tool | Purpose |
|------|---------|
| `mcp__plugin_playwright_playwright__browser_navigate` | Navigate to URL |
| `mcp__plugin_playwright_playwright__browser_snapshot` | Capture page state (accessibility tree) |
| `mcp__plugin_playwright_playwright__browser_click` | Click elements by ref |
| `mcp__plugin_playwright_playwright__browser_type` | Type text into elements |
| `mcp__plugin_playwright_playwright__browser_evaluate` | Run JavaScript in page context |
| `mcp__plugin_playwright_playwright__browser_wait` | Wait for page conditions |

**Usage Pattern for Extension Testing:**

```
1. Build extension:
   npm run build

2. Navigate to vibe-kanban:
   mcp__plugin_playwright_playwright__browser_navigate -> http://localhost:3069

3. Take snapshot to understand page state:
   mcp__plugin_playwright_playwright__browser_snapshot

4. Interact with elements using refs from snapshot:
   mcp__plugin_playwright_playwright__browser_click -> ref="sidebar-toggle"

5. Verify behavior by taking another snapshot or evaluating JS:
   mcp__plugin_playwright_playwright__browser_evaluate -> document.querySelector('.sidebar').classList.contains('open')
```

#### Chrome DevTools MCP - For Debugging

The Chrome DevTools MCP server provides tools for debugging extension behavior.

**Available Tools:**

| Tool | Purpose |
|------|---------|
| `mcp__chrome_devtools__take_snapshot` | Capture full page state |
| `mcp__chrome_devtools__list_console_messages` | View extension console logs |
| `mcp__chrome_devtools__list_network_requests` | Monitor API calls to OTel collector |
| `mcp__chrome_devtools__evaluate_script` | Run JavaScript for debugging |

**Debugging Extension Issues:**

```
1. Check for console errors:
   mcp__chrome_devtools__list_console_messages -> filter "[vibe-tracker]"

2. Verify metrics are being exported:
   mcp__chrome_devtools__list_network_requests -> filter "/v1/metrics"

3. Inspect extension state:
   mcp__chrome_devtools__evaluate_script -> browser.storage.local.get()
```

### 3.3 CI/CD Integration

**Recommended GitHub Actions Structure:**

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  e2e:
    needs: unit-integration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install firefox
      
      - name: Build extension
        run: npm run build
      
      - name: Start vibe-kanban (mock or real)
        run: |
          # Start vibe-kanban in background
          # docker compose up -d vibe-kanban
          # or use mock server
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**Test Gating Rules:**

- Unit tests: Block merge on failure
- Integration tests: Block merge on failure
- E2E tests: Block merge on failure for critical paths
- Coverage: Warn if below 70%, block if below 50%

---

## 4. Manual Testing Workflow

### IMPORTANT: When manual testing is required, provide the user with a packaged ZIP they can directly import.

### Package Creation

```bash
# Build and package the extension
npm run build && npm run package

# Output: vibe-kanban-tracker.zip in project root
```

The `package` script:
1. Builds the extension in production mode
2. Creates a ZIP file from the `dist/` directory
3. Places `vibe-kanban-tracker.zip` in the project root

### User Installation Steps (Firefox/Zen Browser)

1. Open browser and navigate to `about:addons`
2. Click the gear icon (Settings)
3. Select "Install Add-on From File..."
4. Navigate to and select `vibe-kanban-tracker.zip`
5. Accept the permissions when prompted
6. Navigate to `http://localhost:3069` to test

### Alternative: Temporary Installation (Development)

For development testing without packaging:

1. Open browser and navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on..."
4. Navigate to `dist/` folder and select `manifest.json`

### Manual Testing Checklist

| Feature | Test Steps | Expected Result |
|---------|------------|-----------------|
| Extension Load | Install ZIP, visit localhost:3069 | Extension icon appears, no console errors |
| Sidebar Toggle | Click hamburger menu in navbar | Sidebar appears/disappears smoothly |
| Navigation | Navigate between projects/tasks | Toggle button persists, no errors |
| Activity Tracking | Move mouse, scroll, type | Console shows "[vibe-tracker]" activity logs |
| Idle Detection | Stop all activity for 60+ seconds | State transitions to idle |
| Metrics Export | Wait for export cycle (30s) | Network request to OTel collector |
| Page Reload | Reload page during active session | Extension reinitializes correctly |
| Cross-Page | Navigate to different vibe-kanban pages | Tracking continues seamlessly |

### Reporting Manual Test Results

When reporting manual test results, include:

```markdown
## Manual Test Report

**Date:** YYYY-MM-DD
**Tester:** [Name/Agent]
**Extension Version:** [From manifest.json]
**Browser:** Firefox/Zen [version]
**Vibe-Kanban URL:** http://localhost:3069

### Test Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Extension Load | PASS/FAIL | [Details] |
| Sidebar Toggle | PASS/FAIL | [Details] |
| ... | ... | ... |

### Issues Found
- [Issue 1 description]
- [Issue 2 description]

### Console Logs
[Relevant console output]
```

---

## 5. Test Infrastructure Reference

### Key Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Unit/integration test configuration |
| `playwright.config.ts` | E2E test configuration |
| `tests/setup.ts` | Global test setup (fake timers, browser mock initialization) |
| `tests/mocks/browser-mock.ts` | WebExtension API mock (runtime, storage, tabs) |
| `tests/mocks/fetch-mock.ts` | Fetch API mock for network tests |
| `tests/e2e/fixtures.ts` | E2E fixtures including OTel collector mock |
| `tests/fixtures/routes.ts` | Test route data for parsed URLs |

### Test Commands

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests (requires vibe-kanban running at localhost:3069)
npm run test:e2e

# E2E tests in headed mode (visible browser)
npm run test:e2e:headed

# All tests (unit + integration + e2e)
npm run test:all

# Tests with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `SKIP_E2E` | Skip E2E tests when set to "true" | undefined |
| `CI` | CI environment flag, affects retries | undefined |

### Browser Mock Usage

```typescript
import { createBrowserMock, createBrowserMockWithMessageTracking } from '../mocks/browser-mock';

// Basic mock for unit tests
const mockBrowser = createBrowserMock();

// Mock with message simulation for integration tests
const mockBrowser = createBrowserMockWithMessageTracking();
await mockBrowser.simulateMessage({ type: 'ACTIVITY_EVENT' });
```

### OTel Collector Mock (E2E)

```typescript
import { OTelCollectorMock } from './fixtures';

const mock = new OTelCollectorMock(14318);
await mock.start();

// After test actions...
const metrics = mock.getMetrics();
const activeTimeMetrics = mock.getMetricsByName('vibe_kanban.active_time.duration_ms');
expect(mock.hasMetric('vibe_kanban.scroll.count')).toBe(true);

await mock.stop();
```

---

## 6. Bug Fix Testing Protocol

Every bug fix **MUST** include a regression test.

### Required Steps for Bug Fixes

1. **Root cause analysis** - Document what caused the bug
2. **Write failing test first** - Prove the bug exists
3. **Fix the bug** - Make the test pass
4. **Verify no regressions** - Run full test suite

### Test-First Approach for Bugs

```typescript
// 1. Write the failing test FIRST
it('should retain currentRoute when transitioning from idle to active (Bug #123)', () => {
  const route = testRoutes.taskDetail;
  
  stateMachine.transition({ type: 'NAVIGATE', route });
  stateMachine.transition({ type: 'FOCUS' });
  vi.advanceTimersByTime(IDLE_TIMEOUT + 1000);
  stateMachine.transition({ type: 'IDLE_TIMEOUT' });
  stateMachine.transition({ type: 'ACTIVITY' });
  
  // This should NOT be null - that was the bug
  expect(stateMachine.getState().currentRoute).not.toBeNull();
  expect(stateMachine.getState().currentRoute?.projectId).toBe(route.projectId);
});

// 2. Then fix the code to make it pass
```

### Bug Fix Documentation Template

When fixing a bug, document it in the test file:

```markdown
### Bug: [Short Description]

**Root Cause:** [Technical explanation of what caused the bug]

**Why tests missed it:** [Gap in coverage that allowed this bug]

**New test added:** [Test file path and test name]

**Example:**
- Bug: Route lost when transitioning from idle to active
- Root Cause: State machine was resetting route object on state change
- Why tests missed it: No integration test for idle->active with route context
- New test added: tests/unit/background/state-machine.test.ts - "Route Persistence (Bug Regression)"
```

### Regression Test Location

| Bug Type | Test Location |
|----------|---------------|
| State machine logic | `tests/unit/background/state-machine.test.ts` |
| Metrics calculation | `tests/unit/background/metrics-collector.test.ts` |
| URL parsing | `tests/unit/content/url-parser.test.ts` |
| Module interaction | `tests/integration/*.test.ts` |
| User-facing behavior | `tests/e2e/*.spec.ts` |

---

## Summary

1. **Use the decision matrix** to choose the right test type
2. **Automate first** - agents should run tests before every commit
3. **MCP tools** enable automated browser testing and debugging
4. **Manual testing** should use packaged ZIPs for user validation
5. **Every bug fix** must include a regression test
6. **CI/CD** gates prevent broken code from merging

Following this strategy ensures comprehensive test coverage while maintaining development velocity.
