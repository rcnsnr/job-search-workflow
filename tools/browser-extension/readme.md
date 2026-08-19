# Job Search Workflow Capture

A browser extension companion for the [Job Search Workflow](https://github.com/<your-username>/job-search-workflow-capture) job-search workflow. It captures job postings from LinkedIn Jobs, lets you filter by keywords, location, company, and work model, and exports the results as Job Search Workflow Markdown, Job Search Workflow JSONL, CSV, or JSON. Captures can be sent to a local FastAPI capture server that writes to `inbox/jobs/` for unattended workflows, or exported manually and imported later.

## Features

- **Keyword Filtering**: Filter postings by keywords, required keywords, and avoid-list terms.
- **Location & Company Filtering**: Narrow results by location and company name.
- **Speed Profile Management**: Choose conservative, balanced, or aggressive scan pacing to minimize bot-detection risk.
- **Human-like Behavior**: Adds randomized delays to simulate natural browsing.
- **Export Results**: Download filtered postings as **JSON**, **CSV**, **Job Search Workflow Markdown**, or **Job Search Workflow JSONL**.
- **Copy Markdown**: Copy the Job Search Workflow Markdown export to the clipboard.
- **View Results in New Tab**: Open filtered postings in a browser tab.
- **Advanced Options Page**: Configure global whitelist/blacklist, speed profiles, export defaults, and telemetry preferences.
- **Unattended Capture Server**: Post captures to a local FastAPI server for automated `inbox/jobs/` intake.

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/<your-username>/job-search-workflow-capture.git
   cd job-search-workflow-capture
   ```

2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `job-search-workflow-capture` folder.
5. Open the extension card's **Extension options** link to configure settings in a new tab.

## Usage

1. Go to the LinkedIn **Jobs** page.
2. Click the extension icon to open the popup.
3. Set filters:
   - **Keywords**: e.g. `Frontend, Remote, JavaScript`
   - **Location**: e.g. `Remote, Berlin`
   - **Company Name**: e.g. `Google, Microsoft`
   - **Scan Speed**: Delay to reduce bot-detection risk.
4. Press **Save & Scan** to start the scan.
5. When the scan finishes:
   - Download results as **JSON** or **CSV**.
   - Use **Download Job Search Workflow Markdown**, **Download Job Search Workflow JSONL**, or **Copy Markdown** for Job Search Workflow workflow intake.
   - View filtered postings in a new tab.

## Job Search Workflow Export Notes

- Job Search Workflow exports are generated from the currently filtered job list in the popup.
- Markdown file: `jsw-jobs-YYYY-MM-DD.md`
- JSONL file: `jsw-normalized-postings-YYYY-MM-DD.jsonl`
- This flow does **not** write to the Job Search Workflow repo automatically.
- The user downloads or copies the file, then moves or imports it into the Job Search Workflow repo manually.
- The export maps only visible fields from the current job object; it does not export cookies, tokens, sessions, browser profiles, or private payloads.

## Job Search Workflow Profile (Optional)

- From `Options > General > Job Search Workflow Profile`, paste or import a local JSON profile.
- Usage mode is visible:
  - `Off`
  - `Default filters only`
  - `Default filters + export hints`
- This profile is used locally only; no automatic data pull from a sibling Job Search Workflow repo.
- Location eligibility is configurable with generic regions, relocation preference, visa sponsorship preference, relocation-support policy, and an optional foreign onsite/hybrid penalty. No country or region is assumed by default.
- This field is for strategy notes and non-sensitive metadata only. Do not synchronize cookies, tokens, sessions, or private payloads.

## Project Structure

```text
job-search-workflow-capture/
├── manifest.json         # Extension manifest and permissions
├── popup.html            # Popup UI
├── popup.js              # Popup interaction and data handling
├── popup.css             # Popup styles
├── options.html          # Advanced settings UI
├── options.js            # Options page logic
├── options.css           # Options page styles
├── content/
│   ├── jobs.js           # LinkedIn Jobs DOM reading and scanning
│   └── autoscan.js       # Unattended scan content script
├── service_worker.js     # Background alarms, state, and message passing
├── utils/
│   ├── workflow_exporter.js  # Job Search Workflow Markdown/JSONL export
│   ├── workflow_profile.js   # Profile schema and validation
│   ├── logger.js              # Debug logging
│   └── scan_planner.js        # Pacing profiles and query planning
├── scripts/
│   └── validate-manifest.js   # Manifest validation helper
├── tests/                # Jest unit, DOM, and optional e2e tests
└── README.md
```

## Technologies

- **HTML/CSS**: User interface.
- **JavaScript**: Filtering, data processing, and DOM manipulation.
- **Chrome Extension API**: Browser interaction.

## Security

- Adjust scan speed and add random delays to reduce LinkedIn bot-detection risk.
- The extension reads only the active LinkedIn Jobs page and collects only visible posting data.
- Private profile data stays in `chrome.storage.local`; no automatic cloud upload.

## License

This extension is part of Job Search Workflow Community Edition and uses the
repository's [PolyForm Noncommercial 1.0.0 license](../../LICENSE). Commercial
use is not granted by this repository; see the
[Commercial Use and SaaS Boundary](../../COMMERCIAL_USE.md).

## Contributing

Contributions are welcome. To add features or fix bugs:

1. Fork the repository.
2. Create a new branch:

   ```bash
   git checkout -b feature/my-feature
   ```

3. Make your changes and commit:

   ```bash
   git commit -m "feat: description"
   ```

4. Push to your fork:

   ```bash
   git push origin feature/my-feature
   ```

5. Open a pull request.

## Contact

Questions or suggestions? Please open an issue in the GitHub repository.
