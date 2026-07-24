# LinkedIn Job Filter Chrome Extension

A Chrome browser extension for filtering LinkedIn job postings. Users can filter
job listings by **keywords**, **location**, and **company names**. The extension
also simulates human-like behavior to avoid LinkedIn's bot detection.

---

## Features

- **Keyword Filtering**: List postings matching your specified keywords.
- **Location and Company Name Filtering**: Narrow results by location and
  company names.
- **Speed Profile Management**: Choose conservative, balanced, or aggressive
  scan speeds to minimize LinkedIn bot detection.
- **Human-Like Behavior**: Adds random delays to simulate natural browsing.
- **Download Results**: Download filtered postings in **JSON** or **CSV** format.
- **Job Search Export**: Download filtered postings as **Job Search Markdown**,
  **Job Search JSONL**, or copy Markdown content to clipboard.
- **View Results in New Tab**: Display filtered postings as a list in a new
  browser tab.
- **Advanced Options Page**: Configure global whitelist/blacklist, performance
  profiles, export formats, and telemetry preferences via the `Options` UI.

---

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/rcnsnr/job-search-workflow.git
   cd job-search-workflow/tools/browser-extension
   ```

2. Open Chrome and navigate to the **Extensions** page:

   ```text
   chrome://extensions/
   ```

3. Enable **"Developer mode"** in the top-right corner.
4. Click **"Load unpacked"** and select this project's folder.
5. Once loaded, the extension works on LinkedIn Jobs pages.
6. Click **"Extension options"** on the extension card to open the advanced
   settings page in a separate tab.

---

## Usage

1. Go to the **Jobs** page on LinkedIn.
2. Click the extension icon to open the popup UI.
3. Enter your filter criteria:
   - **Keywords**: e.g., `Frontend, Remote, JavaScript`
   - **Location**: e.g., `Remote, London`
   - **Company Name**: e.g., `Google, Microsoft`
   - **Scan Speed**: Delay settings to avoid bot detection.
4. Click **"Save Filters"** to start scanning.
5. When scanning completes:
   - Download results in **JSON** or **CSV** format.
   - Use **Download Markdown**, **Download JSONL**, or **Copy Markdown**
     actions.
   - View filtered postings in a new tab.

### Job Search Export

- The export is generated from the currently filtered job list in the popup.
- Markdown file: `workflow-jobs-YYYY-MM-DD.md`
- JSONL file: `workflow-normalized-postings-YYYY-MM-DD.jsonl`
- This flow **does not write automatically into the Job Search Workflow repo**.
- The user downloads or copies the file, then manually imports it into the Job
  Search Workflow repo if needed.
- Export only maps visible fields from the current job objects; it does not
  export cookies, tokens, sessions, browser profiles, or private payloads.

### Job Search Profile Defaults

- You can paste or import a local JSON profile from
  `Options > General > Job Search Profile`.
- Usage mode is visible:
  - `Off`
  - `Default filters only`
  - `Export hint metadata only`
  - `Default filters + export hints`
- This profile is **local only**; no automatic data fetching from the Job
  Search Workflow repo.
- This field is not for strategy notes, cookies, tokens, sessions, or private
  payload synchronization.
- You can clear and change fields in the popup afterwards; the profile here
  only provides initial defaults.

---

## Project Structure

```text
browser-extension/
├── manifest.json         # Extension manifest and permissions
├── popup.html            # Popup UI
├── popup.js              # Popup interaction and data processing
├── popup.css             # Popup styles
├── options.html          # Advanced settings UI
├── options.js            # Options page logic
├── options.css           # Options page styles
├── content/jobs.js       # LinkedIn Jobs page scraping and scanning
├── content/autoscan.js   # Unattended scan automation
├── service_worker.js     # Background scanning, telemetry, and API requests
├── utils/                # Exporter, profile, logger, scan planner utilities
├── tests/                # Jest unit and DOM tests
└── icon.png              # Extension icon
```

---

## Technologies

- **HTML/CSS**: User interface.
- **JavaScript**: Filtering, data processing, and DOM manipulation.
- **Chrome Extension API**: Browser interaction.

---

## Security and Privacy

- You can adjust scan speed and add random delays to avoid violating LinkedIn's
  bot detection policies.
- The extension only reads and collects data from the user's open LinkedIn Jobs
  page.
- No cookies, tokens, sessions, or private payloads are exported or transmitted.

### LinkedIn Terms of Service — Gray Area Disclaimer

This extension interacts with LinkedIn's public job listing pages. It does not
bypass login walls, paywalls, or access controls. However, automated browsing
may conflict with LinkedIn's Terms of Service. Use this extension at your own
risk. The authors are not responsible for account restrictions or bans.

Premium Insights (Voyager API) features are **disabled by default**. Enabling
them requires explicit opt-in via the Options page and may violate LinkedIn's
Terms of Service. The extension does not transmit Premium data to any third
party.

---

## License

This project is licensed under the
[PolyForm Noncommercial 1.0.0](../../../LICENSE) license.

---

## Contributing

If you'd like to contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch:

   ```bash
   git checkout -b new-feature
   ```

3. Make your changes and commit:

   ```bash
   git commit -m "New feature: ..."
   ```

4. Push to your fork:

   ```bash
   git push origin new-feature
   ```

5. Open a pull request.

---

## Contact

If you have questions or suggestions, please open an issue on
[GitHub Issues](https://github.com/rcnsnr/job-search-workflow/issues).
