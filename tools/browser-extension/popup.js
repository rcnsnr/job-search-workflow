// in-job-search-addon-chrome/popup.js

document.addEventListener("DOMContentLoaded", initPopup);

let currentJobs = [];
let currentOptionsSettings = null;
const MAX_KEYWORD_ITEMS = 50;
const logger = new Logger("Popup");
const profileUtils = window.WorkflowProfileUtils;

function initPopup() {
  logger.info("Popup initializing...");

  const keywordInput = document.getElementById("keyword-input");
  const locationInput = document.getElementById("location-input");
  const companyInput = document.getElementById("company-input");
  const experienceInput = document.getElementById("experience-input");
  const industryInput = document.getElementById("industry-input");
  const keywordWhitelistInput = document.getElementById("keyword-whitelist");
  const keywordBlacklistInput = document.getElementById("keyword-blacklist");
  const minSalaryInput = document.getElementById("min-salary-input");
  const profileInput = document.getElementById("profile-input");
  const remoteOnlyInput = document.getElementById("remote-only");
  const maxAgeInput = document.getElementById("max-age-input");
  const companyOriginInput = document.getElementById("company-origin");
  const saveButton = document.getElementById("save-filters");
  const downloadCSVButton = document.getElementById("download-csv");
  const downloadJSONButton = document.getElementById("download-json");
  const downloadWorkflowMarkdownButton = document.getElementById("download-workflow-markdown");
  const downloadWorkflowJsonlButton = document.getElementById("download-workflow-jsonl");
  const copyWorkflowMarkdownButton = document.getElementById("copy-workflow-markdown");
  const statusBadge = document.getElementById("status");
  const jobList = document.getElementById("job-list");
  const telemetryContainer = document.getElementById("telemetry");

  // Debug panel control
  setupDebugPanel();

  loadFilters({
    keywordInput,
    locationInput,
    companyInput,
    experienceInput,
    industryInput,
    keywordWhitelistInput,
    keywordBlacklistInput,
    companyOriginInput,
    minSalaryInput,
    profileInput,
    remoteOnlyInput,
    maxAgeInput,
    statusBadge,
  });

  refreshTelemetry(telemetryContainer);

  saveButton.addEventListener("click", () => {
    logger.info("Save and Scan button clicked");

    const filters = collectFilters(
      keywordInput,
      locationInput,
      companyInput,
      experienceInput,
      industryInput,
      keywordWhitelistInput,
      keywordBlacklistInput,
      companyOriginInput,
      minSalaryInput,
      profileInput,
      remoteOnlyInput,
      maxAgeInput,
    );

    logger.debug("Toplanan filterler:", filters);

    const validation = validateKeywordFilters(filters, statusBadge);
    if (!validation.ok) {
      logger.warn("Filter validasyonu failed", { validation });
      return;
    }

    const normalizedFilters = {
      ...filters,
      keywordWhitelist: validation.whitelist,
      keywordBlacklist: validation.blacklist,
    };

    logger.info("Normalized filters:", normalizedFilters);

    storeFilters(normalizedFilters, statusBadge);
    requestJobScan(normalizedFilters, statusBadge, jobList);
  });

  downloadCSVButton.addEventListener("click", () => {
    if (!currentJobs.length) {
      setStatus(statusBadge, "empty", "No results to download.");
      return;
    }
    downloadCSV(currentJobs, statusBadge);
  });

  downloadJSONButton.addEventListener("click", () => {
    if (!currentJobs.length) {
      setStatus(statusBadge, "empty", "No results to download.");
      return;
    }
    downloadJSON(currentJobs, statusBadge);
  });

  downloadWorkflowMarkdownButton.addEventListener("click", () => {
    if (!currentJobs.length) {
      setStatus(statusBadge, "empty", "No record to download.");
      return;
    }
    downloadWorkflowMarkdown(currentJobs, statusBadge);
  });

  downloadWorkflowJsonlButton.addEventListener("click", () => {
    if (!currentJobs.length) {
      setStatus(statusBadge, "empty", "No record to download.");
      return;
    }
    downloadWorkflowJsonl(currentJobs, statusBadge);
  });

  copyWorkflowMarkdownButton.addEventListener("click", async () => {
    if (!currentJobs.length) {
      setStatus(statusBadge, "empty", "No record to copy.");
      return;
    }
    await copyWorkflowMarkdown(currentJobs, statusBadge);
  });

  // Auto-save when scan speed is changed for manual refreshes.
  [
    keywordInput,
    locationInput,
    companyInput,
    experienceInput,
    industryInput,
    keywordWhitelistInput,
    keywordBlacklistInput,
    companyOriginInput,
    minSalaryInput,
    profileInput,
    remoteOnlyInput,
    maxAgeInput,
  ].forEach((element) => {
    element.addEventListener("change", () => {
      const filters = collectFilters(
        keywordInput,
        locationInput,
        companyInput,
        experienceInput,
        industryInput,
        keywordWhitelistInput,
        keywordBlacklistInput,
        companyOriginInput,
        minSalaryInput,
        profileInput,
        remoteOnlyInput,
        maxAgeInput,
      );

      const validation = validateKeywordFilters(filters, statusBadge, { silent: true });
      if (!validation.ok) {
        return;
      }

      const normalizedFilters = {
        ...filters,
        keywordWhitelist: validation.whitelist,
        keywordBlacklist: validation.blacklist,
      };

      storeFilters(normalizedFilters, statusBadge, false);
    });
  });
}

function parseKeywordListValue(rawValue) {
  if (!rawValue) {
    return [];
  }

  const items = rawValue
    .split(/\r?\n|,/)
    .map((item) => normalizeKeywordValue(item))
    .filter(Boolean);

  const seen = new Set();
  const result = [];

  items.forEach((item) => {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  });

  return result;
}

function formatKeywordTextarea(value) {
  if (!value) {
    return "";
  }

  const list = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim() ? [value] : [];

  const sanitized = sanitizeKeywordList(list);
  return sanitized.items.join("\n");
}

function collectFilters(
  keywordInput,
  locationInput,
  companyInput,
  experienceInput,
  industryInput,
  keywordWhitelistInput,
  keywordBlacklistInput,
  companyOriginInput,
  minSalaryInput,
  profileInput,
  remoteOnlyInput,
  maxAgeInput,
) {
  const maxAgeRaw = maxAgeInput.value.trim();
  const parsedMaxAge = Number.parseInt(maxAgeRaw, 10);
  const minSalaryRaw = minSalaryInput.value.trim();
  const parsedMinSalary = Number.parseInt(minSalaryRaw, 10);

  return {
    keywords: keywordInput.value.trim(),
    location: locationInput.value.trim(),
    company: companyInput.value.trim(),
    experience: experienceInput.value.trim(),
    industry: industryInput.value.trim(),
    keywordWhitelist: parseKeywordListValue(keywordWhitelistInput.value),
    keywordBlacklist: parseKeywordListValue(keywordBlacklistInput.value),
    companyOrigin: companyOriginInput.value,
    minSalary: Number.isNaN(parsedMinSalary) ? null : parsedMinSalary,
    profile: profileInput.value,
    remoteOnly: remoteOnlyInput.checked,
    maxAgeDays: Number.isNaN(parsedMaxAge) ? null : parsedMaxAge,
  };
}

function loadFilters({
  keywordInput,
  locationInput,
  companyInput,
  experienceInput,
  industryInput,
  keywordWhitelistInput,
  keywordBlacklistInput,
  companyOriginInput,
  minSalaryInput,
  profileInput,
  remoteOnlyInput,
  maxAgeInput,
  statusBadge,
}) {
  chrome.storage.local.get(["filters", "optionsSettings"], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading filters", chrome.runtime.lastError);
      setStatus(statusBadge, "error", "Could not load filters.");
      return;
    }

    currentOptionsSettings = result?.optionsSettings ?? {};
    const filters = profileUtils
      ? profileUtils.resolvePopupFilters(result?.filters ?? {}, currentOptionsSettings)
      : (result?.filters ?? {});
    keywordInput.value = filters.keywords ?? "";
    locationInput.value = filters.location ?? "";
    companyInput.value = filters.company ?? "";
    experienceInput.value = filters.experience ?? "";
    industryInput.value = filters.industry ?? "";
    const sanitizedFromStorage = validateKeywordFilters({
      keywordWhitelist: Array.isArray(filters.keywordWhitelist) ? filters.keywordWhitelist : [],
      keywordBlacklist: Array.isArray(filters.keywordBlacklist) ? filters.keywordBlacklist : [],
    }, statusBadge, { silent: true, skipLimits: true });

    keywordWhitelistInput.value = formatKeywordTextarea(sanitizedFromStorage.whitelist);
    keywordBlacklistInput.value = formatKeywordTextarea(sanitizedFromStorage.blacklist);
    minSalaryInput.value = filters.minSalary ?? "";
    companyOriginInput.value = filters.companyOrigin ?? "any";
    profileInput.value = filters.profile ?? inferProfileFromLegacySpeed(filters.speed);
    remoteOnlyInput.checked = Boolean(filters.remoteOnly);
    maxAgeInput.value = filters.maxAgeDays ?? "";

    setStatus(statusBadge, "ready", "Ready");
  });
}

function storeFilters(filters, statusBadge, showMessage = true) {
  chrome.storage.local.set({ filters }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving filters", chrome.runtime.lastError);
      setStatus(statusBadge, "error", "Filters could not be saved.");
      return;
    }

    if (showMessage) {
      setStatus(statusBadge, "ready", "Filters saved. Starting scan...");
    }
  });
}

function requestJobScan(filters, statusBadge, jobList) {
  logger.info("Starting job scan...", { filters });
  setStatus(statusBadge, "loading", "Job posting scan started...");
  renderJobs(jobList, []);

  try {
    logger.debug("Sending message to service worker...");

    chrome.runtime.sendMessage({
      action: "startJobScan",
      filters,
    }, (response) => {
      try {
        logger.debug("Response received from service worker", { response });

        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          logger.error("Could not communicate with service worker", { error });
          console.error("Could not communicate with service worker", chrome.runtime.lastError);
          setStatus(statusBadge, "error", "Service worker did not respond: " + error);
          return;
        }

        if (!response) {
          logger.error("Could not get response from service worker");
          setStatus(statusBadge, "error", "Could not get response from service worker.");
          return;
        }

        if (!response.success) {
          const errorMsg = response.error || "An unknown error occurred";
          logger.error("Scan error", { errorMsg, response });
          console.error("Scan error:", errorMsg);
          setStatus(statusBadge, "error", "Error: " + errorMsg);
          return;
        }

        currentJobs = response.jobs ?? [];
        renderJobs(jobList, currentJobs);

        if (currentJobs.length === 0) {
          setStatus(statusBadge, "empty", "No results matching your filters.");
          return;
        }

        const processedAt = response.metadata?.processedAt ? new Date(response.metadata.processedAt) : new Date();
        const info = `${currentJobs.length} posting found (${processedAt.toLocaleTimeString("tr-TR")})`;
        setStatus(statusBadge, "success", info);

        // Telemetry rendering with error handling
        try {
          renderTelemetry(
            document.getElementById("telemetry"),
            response.metadata?.telemetry,
            {
              profile: response.metadata?.profile,
              delayMs: response.metadata?.delayMs,
              throttle: response.metadata?.throttle,
            },
          );
          refreshTelemetry(document.getElementById("telemetry"));
        } catch (telemetryError) {
          console.warn("Telemetry display error:", telemetryError);
        }

      } catch (responseError) {
        console.error("Response processing error:", responseError);
        setStatus(statusBadge, "error", "Response could not be processed: " + responseError.message);
      }
    });
  } catch (error) {
    console.error("Message sending error:", error);
    setStatus(statusBadge, "error", "Communication error: " + error.message);
  }
}

function renderJobs(jobList, jobs) {
  jobList.innerHTML = "";

  if (!jobs.length) {
    const placeholder = document.createElement("li");
    placeholder.textContent = "No results yet.";
    jobList.appendChild(placeholder);
    return;
  }

  jobs.forEach((job) => {
    const listItem = document.createElement("li");
    const title = job.title || "Namesiz posting";
    const company = job.company ? ` • ${job.company}` : "";
    const location = job.location ? ` • ${job.location}` : "";
    const workplace = job.workplaceType ? ` • ${job.workplaceType}` : "";
    const posted = job.postedAt ? ` • ${formatRelativeDate(job.postedAt)}` : "";
    const experience = job.experienceLevel ? ` • ${job.experienceLevel}` : "";
    const industries = Array.isArray(job.industries) && job.industries.length > 0
      ? ` • ${job.industries.join(" / ")}`
      : "";
    const salary = job.salaryText ? ` • ${job.salaryText}` : "";

    if (job.link) {
      const link = document.createElement("a");
      link.href = job.link;
      link.textContent = title;
      link.className = "job-link";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      listItem.appendChild(link);
    } else {
      listItem.textContent = title;
    }

    const meta = document.createElement("span");
    meta.textContent = `${company}${location}${workplace}${posted}${experience}${industries}${salary}`;
    listItem.appendChild(meta);

    jobList.appendChild(listItem);
  });
}

function downloadCSV(jobs, statusBadge) {
  try {
    const header = "Title,Company,Location,WorkplaceType,PostedAt,ExperienceLevel,Industries,SalaryMin,SalaryMax,SalaryText,Link";
    const rows = jobs.map((job) => [
      job.title,
      job.company,
      job.location,
      job.workplaceType,
      job.postedAt,
      job.experienceLevel,
      Array.isArray(job.industries) ? job.industries.join(" | ") : job.industries,
      job.salaryMin,
      job.salaryMax,
      job.salaryText,
      job.link,
    ]
      .map((value) => `"${(value ?? "").replaceAll("\"", "\"\"")}"`).join(","));
    const csvContent = `data:text/csv;charset=utf-8,${[header, ...rows].join("\n")}`;

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "filtered_jobs.csv";
    link.click();

    setStatus(statusBadge, "success", "CSV indirildi.");
  } catch (error) {
    console.error("Could not create CSV", error);
    setStatus(statusBadge, "error", "CSV indirme failed oldu.");
  }
}

function downloadJSON(jobs, statusBadge) {
  try {
    const jsonContent = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(jobs, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonContent;
    link.download = "filtered_jobs.json";
    link.click();

    setStatus(statusBadge, "success", "JSON indirildi.");
  } catch (error) {
    console.error("Could not create JSON", error);
    setStatus(statusBadge, "error", "JSON indirme failed oldu.");
  }
}

function getWorkflowExporter() {
  return window.WorkflowExporter;
}

function getWorkflowCaptureDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildWorkflowOptions() {
  const options = {
    capturedAt: getWorkflowCaptureDate(),
  };

  if (profileUtils && currentOptionsSettings) {
    const mode = currentOptionsSettings.workflowProfileMode;
    if (profileUtils.profileModeUsesExportHints(mode)) {
      options.workflowProfile = currentOptionsSettings.workflowProfile;
      options.workflowProfileMode = mode;
    }
  }

  return options;
}

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadWorkflowMarkdown(jobs, statusBadge) {
  const exporter = getWorkflowExporter();
  if (!exporter) {
    setStatus(statusBadge, "error", "Workflow exporter could not be loaded.");
    return;
  }

  try {
    const options = buildWorkflowOptions();
    const markdown = exporter.toWorkflowMarkdown(jobs, options);
    downloadTextFile(markdown, `workflow-jobs-${options.capturedAt}.md`, "text/markdown");
    setStatus(statusBadge, "success", "Workflow Markdown downloaded.");
  } catch (error) {
    console.error("Could not create Workflow Markdown", error);
    setStatus(statusBadge, "error", "Could not download Workflow Markdown.");
  }
}

function downloadWorkflowJsonl(jobs, statusBadge) {
  const exporter = getWorkflowExporter();
  if (!exporter) {
    setStatus(statusBadge, "error", "Workflow exporter could not be loaded.");
    return;
  }

  try {
    const options = buildWorkflowOptions();
    const jsonl = exporter.toWorkflowJsonl(jobs, options);
    downloadTextFile(
      jsonl,
      `workflow-normalized-postings-${options.capturedAt}.jsonl`,
      "application/x-ndjson",
    );
    setStatus(statusBadge, "success", "Workflow JSONL downloaded.");
  } catch (error) {
    console.error("Could not create Workflow JSONL", error);
    setStatus(statusBadge, "error", "Could not download Workflow JSONL.");
  }
}

async function copyWorkflowMarkdown(jobs, statusBadge) {
  const exporter = getWorkflowExporter();
  if (!exporter) {
    setStatus(statusBadge, "error", "Workflow exporter could not be loaded.");
    return;
  }

  try {
    const markdown = exporter.toWorkflowMarkdown(jobs, buildWorkflowOptions());

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = markdown;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setStatus(statusBadge, "success", "Workflow Markdown copied to clipboard.");
  } catch (error) {
    console.error("Could not copy Workflow Markdown", error);
    setStatus(statusBadge, "error", "Could not copy Workflow Markdown.");
  }
}

function setStatus(statusBadge, state, message) {
  const allowedStates = ["ready", "loading", "success", "error", "empty"];
  const normalizedState = allowedStates.includes(state) ? state : "ready";
  statusBadge.textContent = message;
  statusBadge.className = `status status--${normalizedState}`;
}

function inferProfileFromLegacySpeed(speed) {
  if (!speed) {
    return "balanced";
  }

  const numeric = Number(speed);
  if (Number.isNaN(numeric)) {
    return "balanced";
  }

  if (numeric >= 7000) {
    return "conservative";
  }

  if (numeric <= 3000) {
    return "aggressive";
  }

  return "balanced";
}

function formatRelativeDate(isoString) {
  if (!isoString) {
    return "";
  }

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString("tr-TR");
}

// Debug Panel Management
function setupDebugPanel() {
  logger.info("Debug panel kuruluyor...");

  const debugPanel = document.getElementById("debug-panel");
  const toggleButton = document.getElementById("toggle-debug");
  const exportButton = document.getElementById("export-logs");
  const clearButton = document.getElementById("clear-logs");
  const debugLogsContainer = document.getElementById("debug-logs");

  // Show debug panel
  if (debugPanel) {
    debugPanel.style.display = "block";
    logger.info("Debug panel made visible");
  }

  // Toggle logs show/hide
  let logsVisible = false;
  if (toggleButton) {
    toggleButton.addEventListener("click", async () => {
      logsVisible = !logsVisible;
      if (logsVisible) {
        await renderDebugLogs(debugLogsContainer);
        debugLogsContainer.style.display = "block";
      } else {
        debugLogsContainer.style.display = "none";
      }
    });
  }

  // Export logs
  if (exportButton) {
    exportButton.addEventListener("click", async () => {
      logger.info("Exporting logs...");
      await Logger.exportLogs();
    });
  }

  // Clear logs
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all debug logs?")) {
        logger.info("Loglar temizleniyor...");
        Logger.clearLogs();
        debugLogsContainer.innerHTML = "<p style=\"color: #6c757d;\">Loglar temizlendi.</p>";
      }
    });
  }

  // Auto-update logs every 5 seconds (if visible)
  setInterval(async () => {
    if (logsVisible && debugLogsContainer.style.display !== "none") {
      await renderDebugLogs(debugLogsContainer);
    }
  }, 5000);
}

async function renderDebugLogs(container) {
  if (!container) {
    return;
  }

  const logs = await Logger.getLogs();

  if (logs.length === 0) {
    container.innerHTML = "<p style=\"color: #6c757d;\">No log records yet.</p>";
    return;
  }

  // Show last 50 logs
  const recentLogs = logs.slice(-50).reverse();

  container.innerHTML = recentLogs.map(log => {
    const dataStr = log.data ? `<span class="debug-log-data">${JSON.stringify(log.data)}</span>` : "";
    return `
      <div class="debug-log-entry ${log.level}">
        <span class="debug-log-timestamp">${log.timestamp}</span>
        <span class="debug-log-context">[${log.context}]</span>
        <span class="debug-log-message">${log.message}</span>
        ${dataStr}
      </div>
    `;
  }).join("");

  // En alta scroll
  container.scrollTop = container.scrollHeight;
}

function refreshTelemetry(container) {
  chrome.runtime.sendMessage({ action: "getTelemetry" }, (response) => {
    if (chrome.runtime.lastError) {
      renderTelemetryError(container, chrome.runtime.lastError.message);
      return;
    }

    if (!response?.success) {
      renderTelemetryError(container, response?.error ?? "Telemetry unavailable");
      return;
    }

    renderTelemetry(container, response.telemetry);
  });
}

function renderTelemetry(container, telemetry, metadata = {}) {
  if (!container) {
    return;
  }

  const processedToday = telemetry?.processedToday ?? 0;
  const lastProfile = metadata.profile ?? telemetry?.lastProfileUsed ?? "Unknown";
  const delayInfo = metadata.delayMs ? `${metadata.delayMs} ms` : "—";
  const throttleRange = Array.isArray(metadata?.throttle?.delayRangeMs)
    ? `${metadata.throttle.delayRangeMs[0]}–${metadata.throttle.delayRangeMs[1]} ms`
    : "—";
  const lastProcessed = telemetry?.lastProcessedAt
    ? formatRelativeTimestamp(telemetry.lastProcessedAt)
    : "Not processed yet";
  const premiumLimit = telemetry?.premiumLimit ?? 50;
  const premiumUsed = telemetry?.premiumCallsToday ?? 0;
  const premiumRemaining = telemetry?.premiumRemaining ?? Math.max(0, premiumLimit - premiumUsed);
  const premiumLast = telemetry?.premiumLastRequestAt
    ? formatRelativeTimestamp(telemetry.premiumLastRequestAt)
    : "No requests yet";

  container.innerHTML = `
    <h4>Daily Profile Status</h4>
    <p class="telemetry__stat"><strong>Active profile:</strong> ${lastProfile}</p>
    <p class="telemetry__stat"><strong>Tasks processed today:</strong> ${processedToday}</p>
    <p class="telemetry__stat"><strong>Last gecikme:</strong> ${delayInfo}</p>
    <p class="telemetry__stat"><strong>Profile range:</strong> ${throttleRange}</p>
    <p class="telemetry__stat"><strong>Last processing time:</strong> ${lastProcessed}</p>
    <hr>
    <p class="telemetry__stat"><strong>Premium toplam kota:</strong> ${premiumLimit}</p>
    <p class="telemetry__stat"><strong>Premium used:</strong> ${premiumUsed}</p>
    <p class="telemetry__stat"><strong>Kalan Premium kota:</strong> ${premiumRemaining}</p>
    <p class="telemetry__stat"><strong>Last premium request:</strong> ${premiumLast}</p>
  `;
}

function renderTelemetryError(container, message) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <h4>Daily Profile Status</h4>
    <p class="telemetry__stat">Telemetry could not be loaded: ${message}</p>
  `;
}

function formatRelativeTimestamp(value) {
  if (!value) {
    return "Not processed yet";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "Now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return new Date(timestamp).toLocaleString("tr-TR");
}

function normalizeKeywordValue(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

function sanitizeKeywordList(list) {
  if (!Array.isArray(list)) {
    return { items: [], truncated: false };
  }

  const uniqueItems = [];
  const seen = new Set();

  for (const item of list) {
    const normalized = normalizeKeywordValue(item);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(normalized);
    }

    if (uniqueItems.length >= MAX_KEYWORD_ITEMS) {
      break;
    }
  }

  return {
    items: uniqueItems,
    truncated: list.length > uniqueItems.length,
  };
}

function validateKeywordFilters(filters, statusBadge, options = {}) {
  const silent = options.silent ?? false;
  const skipLimits = options.skipLimits ?? false;

  const whitelist = Array.isArray(filters.keywordWhitelist) ? filters.keywordWhitelist : [];
  const blacklist = Array.isArray(filters.keywordBlacklist) ? filters.keywordBlacklist : [];

  const sanitizedWhitelist = sanitizeKeywordList(whitelist);
  const sanitizedBlacklist = sanitizeKeywordList(blacklist);

  if (!skipLimits && sanitizedWhitelist.truncated && !silent) {
    setStatus(statusBadge, "error", `Whitelist can contain maximum ${MAX_KEYWORD_ITEMS} items.`);
    return { ok: false, whitelist: [], blacklist: [] };
  }

  if (!skipLimits && sanitizedBlacklist.truncated && !silent) {
    setStatus(statusBadge, "error", `Blacklist can contain maximum ${MAX_KEYWORD_ITEMS} items.`);
    return { ok: false, whitelist: [], blacklist: [] };
  }

  return {
    ok: true,
    whitelist: sanitizedWhitelist.items,
    blacklist: sanitizedBlacklist.items,
  };
}
