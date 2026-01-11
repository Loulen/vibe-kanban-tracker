# Installing Vibe Kanban Tracker (Permanent Installation)

This guide explains how to permanently install the Vibe Kanban Tracker extension in Firefox or Zen browser using Mozilla's extension signing process.

## Why Signing is Required

Firefox blocks unsigned extensions for security reasons. To permanently install a self-developed extension, you must either:

1. **Sign the extension through Mozilla** (recommended) - Creates a signed `.xpi` file that Firefox will accept
2. **Use Firefox Developer Edition** with signature checking disabled

This guide covers both approaches.

---

## Prerequisites

Before you begin, ensure you have:

- **Mozilla/Firefox Account** - Required for API access ([Sign up here](https://accounts.firefox.com/))
- **Node.js v18 or later** - For building and signing the extension
- **The extension source code** - The `vibe-kanban-tracker/` directory

---

## Option 1: Sign Through Mozilla (Recommended)

### Step 1: Get API Credentials

1. Log in to your Mozilla account
2. Visit the [API Key Management page](https://addons.mozilla.org/developers/addon/api/key/)
3. Click "Generate new credentials"
4. You will receive two values:
   - **JWT issuer** (also called API Key) - A string like `user:12345678:123`
   - **JWT secret** (also called API Secret) - A long random string

> **Important:** Keep these credentials secure. The JWT secret is shown only once.

### Step 2: Configure Environment

1. Navigate to the extension directory:
   ```bash
   cd vibe-kanban-tracker
   ```

2. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

3. Edit `.env.local` and fill in your credentials:
   ```bash
   WEB_EXT_API_KEY=user:12345678:123
   WEB_EXT_API_SECRET=your_jwt_secret_here
   ```

### Step 3: Install Dependencies

```bash
npm install
```

This installs all required packages including `web-ext` for signing.

### Step 4: Build and Sign

1. Load your credentials into the environment:
   ```bash
   export $(cat .env.local | xargs)
   ```

2. Build and sign the extension:
   ```bash
   npm run sign
   ```

3. The signing process will:
   - Build the extension to `dist/`
   - Submit to Mozilla for signing
   - Download the signed `.xpi` file to `web-ext-artifacts/`

> **Note:** Signing may take a few minutes. The output will show the path to the signed file.

### Step 5: Install the Extension

#### Firefox

1. Open Firefox and navigate to `about:addons`
2. Click the gear icon (Settings)
3. Select **"Install Add-on From File..."**
4. Navigate to `web-ext-artifacts/` and select the `.xpi` file
5. Click "Add" when prompted

#### Zen Browser

Zen browser is Firefox-based, so the installation process is identical:

1. Open Zen and navigate to `about:addons`
2. Click the gear icon (Settings)
3. Select **"Install Add-on From File..."**
4. Navigate to `web-ext-artifacts/` and select the `.xpi` file
5. Click "Add" when prompted

### Verify Installation

1. Navigate to `about:addons`
2. The extension "Vibe Kanban Tracker" should appear in the list
3. Open `http://localhost:3069` (vibe-kanban) to verify tracking activates

---

## Option 2: Firefox Developer Edition (No Mozilla Account)

If you prefer not to create a Mozilla account, you can use Firefox Developer Edition or Firefox Nightly with signature checking disabled.

### Step 1: Install Firefox Developer Edition

Download from: https://www.mozilla.org/firefox/developer/

### Step 2: Disable Signature Requirement

1. Open Firefox Developer Edition
2. Navigate to `about:config`
3. Accept the warning
4. Search for `xpinstall.signatures.required`
5. Double-click to set it to `false`

> **Warning:** This setting reduces security by allowing unsigned extensions. Only use this in development environments.

### Step 3: Build the Extension

```bash
cd vibe-kanban-tracker
npm install
npm run build
```

### Step 4: Create Installable Package

```bash
npm run package
```

This creates `vibe-kanban-tracker.zip` in the project root.

### Step 5: Install the Extension

1. Open Firefox Developer Edition
2. Navigate to `about:addons`
3. Click the gear icon (Settings)
4. Select **"Install Add-on From File..."**
5. Select `vibe-kanban-tracker.zip`
6. Click "Add" when prompted

---

## Troubleshooting

### "Signing request failed"

- **Check credentials:** Verify `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` are correct in `.env.local`
- **Regenerate credentials:** If credentials expired, generate new ones at the [API Key page](https://addons.mozilla.org/developers/addon/api/key/)
- **Check network:** Ensure you have internet access to reach Mozilla's servers

### "Extension is not signed"

- For standard Firefox, you must use the signed `.xpi` from `web-ext-artifacts/`
- For Firefox Developer Edition, ensure `xpinstall.signatures.required` is set to `false`

### "Add-on could not be installed because it appears to be corrupt"

- Ensure you're installing the `.xpi` file from `web-ext-artifacts/`, not the `.zip` file
- Try rebuilding and re-signing: `npm run sign`

### "Extension ID already exists"

- The extension ID is defined in `manifest.json` (`vibe-kanban-tracker@localhost`)
- If you've previously installed this extension, remove it first via `about:addons`

### Build fails with "Cannot find module"

- Run `npm install` to ensure all dependencies are installed
- Ensure you're using Node.js v18 or later: `node --version`

### Signed extension not appearing in `web-ext-artifacts/`

- Check the console output for errors from Mozilla's API
- Ensure your credentials have not expired (regenerate if needed)
- Try running the sign command directly with verbose output:
  ```bash
  npx web-ext sign --source-dir=dist --channel=unlisted --verbose
  ```

### Extension not tracking activity

After installation:
1. Open the extension options page
2. Ensure "Enable Tracking" is checked
3. Verify the OTel endpoint is correct (default: `http://localhost:4318`)
4. Navigate to `http://localhost:3069` (vibe-kanban) - tracking only works on this URL

---

## Updating the Extension

When you make changes to the extension:

1. Increment the version in `manifest.json`
2. Re-run the signing process:
   ```bash
   export $(cat .env.local | xargs)
   npm run sign
   ```
3. Install the new `.xpi` file (it will replace the old version)

---

## Summary

| Method | Pros | Cons |
|--------|------|------|
| **Mozilla Signing** | Works in all Firefox versions, permanent installation | Requires Mozilla account, signing takes time |
| **Developer Edition** | No account needed, faster iteration | Reduced security, only works in Dev/Nightly |

For production use, Mozilla signing is recommended. For active development, consider using the Developer Edition approach or the temporary installation method described in `README.md`.
