# Browser Extension Install Runbook

Install the `Job Search Workflow Capture` extension in Chrome in developer
mode. This runbook covers the load-unpacked flow used for Phase 1 releases.

## Prerequisites

- Chrome, Chromium, Brave, or another Chromium-based browser.
- Extension source files in `public/tools/browser-extension/`.

## Install steps

1. Open the browser and navigate to the extensions management page:

   ```text
   chrome://extensions
   ```

2. Enable **Developer mode** with the toggle in the top-right corner.

3. Click **Load unpacked**.

4. Select the `public/tools/browser-extension/` directory (or the extracted
   `.zip` release folder).

5. The extension appears in the extensions list as `Job Search Workflow Capture`.

6. Pin the extension to the toolbar for easy access.

7. Open the extension options:
   - Click the extension card's **Extension options** link, or
   - Right-click the toolbar icon and choose **Options**.

## Verify the install

1. Open a LinkedIn Jobs search or recommendations page, for example:

   ```text
   https://www.linkedin.com/jobs/
   ```

2. Click the extension icon to open the popup.

3. Enter keywords, location, and optional company filters.

4. Click **Save & Scan**.

5. Wait for the scan to finish. The popup shows the result count and action
   buttons.

6. Click **Download Job Search Workflow Markdown** and confirm a `.md` file is saved.

## Options configuration

The options page has several tabs:

- **General** — default keywords, speed profile, Job Search Workflow profile mode.
- **Advanced Filters** — global whitelist/blacklist, company blacklist, default
  minimum salary, outsourcing exclusion.
- **Performance** — maximum results per scan, premium quota, storage cleanup.
- **Export** — default export format, export fields, automatic filename.
- **Unattended Scan** — keyword list, locations, date filter, speed profile,
  work model, job type, capture server URL, scan frequency.
- **Advanced** — debug logging, telemetry, experimental features.
- **Data Management** — export/import/reset/clear settings.

### Recommended first-time settings

| Setting | Recommendation |
| --- | --- |
| Default speed profile | `Conservative` until you confirm the scan is stable. |
| Maximum results | `100` for the first scans. |
| Export format | `jsw_markdown` or `jsw_jsonl`. |
| Capture server URL | `http://localhost:8766` if you run the capture server. |

## Unattended scan setup

To enable unattended capture:

1. Start the capture server (see `capture-server-setup.md`).
2. In the options page, open the **Unattended Scan** tab.
3. Set the capture server URL to `http://localhost:8766`.
4. Add keywords and optional locations.
5. Choose a date filter and speed profile.
6. Set the alarm frequency in minutes.
7. Click **Scan Now** for an immediate run or wait for the next alarm.

The server writes one Markdown file per posting to `inbox/jobs/`, deduplicating by
`source_url`.

## Troubleshooting

### The popup says "No results matching your filters"

- The scan completed but no visible postings matched your filters.
- Widen keywords, remove location constraints, or disable the remote-only filter.
- Check that you are on a LinkedIn Jobs search or recommendations page.

### The scan hangs on "Scan started"

- Check the browser console for content-script or service-worker errors.
- Open `chrome://extensions` and click the extension's **service worker** link.
- Enable **Verbose** debug logging in the options page and export the logs.

### Exports are empty

- Ensure postings are visible on the page before scanning.
- Increase **Maximum result count** in the options page.
- Check that the content script loaded (look for the extension marker in the
  page DOM).

### "Could not communicate with service worker"

- Reload the extension from `chrome://extensions`.
- Restart the browser.
- Check that `service_worker.js` is in the extension root directory.

### LinkedIn shows a challenge page

- Reduce scan speed to `Conservative`.
- Increase the delay values in the speed profile.
- Avoid unattended scans on the same account too frequently.

## Update the extension

1. Download the latest `.zip` release.
2. Extract it to a folder.
3. In `chrome://extensions`, find the existing extension and click **Remove**.
4. Click **Load unpacked** and select the extracted folder.

Your options are stored in `chrome.storage.local`; they are lost when the
extension is removed. Use **Export Settings** in the options page before
removing.
