// options.js - Job Search Workflow Capture Options Page
document.addEventListener("DOMContentLoaded", initOptionsPage);

const profileUtils = window.WorkflowProfileUtils;
const PROFILE_MODE_VALUES = profileUtils ? new Set(Object.values(profileUtils.PROFILE_MODES)) : new Set(["off"]);

// Default settings configuration
const DEFAULT_SETTINGS = {
  // General
  defaultKeywords: "",
  defaultLocation: "",
  defaultProfile: "balanced",
  autoSaveFilters: true,

  // Filters
  globalWhitelist: "",
  globalBlacklist: "",
  companyBlacklist: "",
  minSalaryDefault: null,
  excludeOutsourcingDefault: false,

  // Performance
  maxResults: 200,
  premiumQuota: 50,
  enablePremiumInsights: true,
  autoCleanupStorage: true,

  // Export
  exportFormat: "csv",
  exportFields: {
    title: true,
    company: true,
    location: true,
    salary: false,
    experience: false,
    workplace: false,
    postedDate: false,
    premiumData: false,
  },
  autoFilename: true,

  // Namevanced
  debugMode: "off",
  enableTelemetry: true,
  experimentalFeatures: false,

  // Unattended scan
  captureServerUrl: "http://localhost:8766",
  unattendedKeywords: "",
  unattendedLocations: "",
  unattendedDateFilter: "r604800",
  unattendedRemoteOnly: false,
  unattendedSearchMode: "keyword",
  unattendedWorkTypes: ["2"],
  unattendedJobTypes: ["F"],
  unattendedExperienceLevels: ["4"],
  unattendedSortBy: "DD",
  unattendedEasyApply: false,
  unattendedActivelyHiring: false,
  unattendedUnder10Applicants: false,
  unattendedVerifiedJobs: false,
  unattendedCompanyIds: "",
  unattendedCityIds: "",
  unattendedPacingProfile: "conservative",
  unattendedPeriodMinutes: 60,

  // Workflow profile
  workflowProfileMode: profileUtils ? profileUtils.PROFILE_MODES.OFF : "off",
  workflowProfileJson: "",
  workflowProfile: profileUtils ? profileUtils.normalizeWorkflowProfile({}) : {},
};

let currentSettings = { ...DEFAULT_SETTINGS };

function normalizeSettings(storedSettings) {
  const settings = storedSettings && typeof storedSettings === "object" ? storedSettings : {};
  const normalizedProfile = profileUtils
    ? profileUtils.normalizeWorkflowProfile(settings.workflowProfile)
    : {};

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    exportFields: {
      ...DEFAULT_SETTINGS.exportFields,
      ...(settings.exportFields || {}),
    },
    workflowProfileMode: PROFILE_MODE_VALUES.has(settings.workflowProfileMode)
      ? settings.workflowProfileMode
      : DEFAULT_SETTINGS.workflowProfileMode,
    workflowProfileJson: typeof settings.workflowProfileJson === "string"
      ? settings.workflowProfileJson
      : (profileUtils ? JSON.stringify(normalizedProfile, null, 2) : ""),
    workflowProfile: normalizedProfile,
  };
}

async function initOptionsPage() {
  await loadSettings();
  setupTabNavigation();
  setupFormElements();
  setupEventListeners();
  updatePerformanceStats();
  updateSystemInfo();
}

// Tab Navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;

      // Remove active class from all tabs
      tabButtons.forEach(btn => btn.classList.remove("active"));
      tabContents.forEach(content => content.classList.remove("active"));

      // Named active class to clicked tab
      button.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });
}

// Load settings from storage
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(["optionsSettings"]);
    currentSettings = normalizeSettings(stored.optionsSettings);
    populateFormFields();
  } catch (error) {
    console.error("Error loading settings:", error);
    showSaveStatus("error", "Error occurred while loading settings");
  }
}

function getMultiCheckboxGroup(prefix) {
  return Array.from(document.querySelectorAll(`input[type="checkbox"][id^="${prefix}"]`))
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function setMultiCheckboxGroup(prefix, values) {
  const valueSet = new Set(values || []);
  Array.from(document.querySelectorAll(`input[type="checkbox"][id^="${prefix}"]`)).forEach((checkbox) => {
    checkbox.checked = valueSet.has(checkbox.value);
  });
}

// Populate form fields with current settings
function populateFormFields() {
  // General tab
  document.getElementById("default-keywords").value = currentSettings.defaultKeywords;
  document.getElementById("default-location").value = currentSettings.defaultLocation;
  document.getElementById("default-profile").value = currentSettings.defaultProfile;
  document.getElementById("auto-save-filters").checked = currentSettings.autoSaveFilters;

  // Filters tab
  document.getElementById("global-whitelist").value = currentSettings.globalWhitelist;
  document.getElementById("global-blacklist").value = currentSettings.globalBlacklist;
  document.getElementById("company-blacklist").value = currentSettings.companyBlacklist;
  document.getElementById("min-salary-default").value = currentSettings.minSalaryDefault || "";
  document.getElementById("exclude-outsourcing-default").checked = currentSettings.excludeOutsourcingDefault;

  // Performance tab
  document.getElementById("max-results").value = currentSettings.maxResults;
  document.getElementById("premium-quota").value = currentSettings.premiumQuota;
  document.getElementById("enable-premium-insights").checked = currentSettings.enablePremiumInsights;
  document.getElementById("auto-cleanup-storage").checked = currentSettings.autoCleanupStorage;

  // Export tab
  document.getElementById("export-format").value = currentSettings.exportFormat;
  Object.keys(currentSettings.exportFields).forEach(field => {
    const checkbox = document.getElementById(`export-${field.replace(/([A-Z])/g, "-$1").toLowerCase()}`);
    if (checkbox) {
      checkbox.checked = currentSettings.exportFields[field];
    }
  });
  document.getElementById("auto-filename").checked = currentSettings.autoFilename;

  // Namevanced tab
  document.getElementById("debug-mode").value = currentSettings.debugMode;
  document.getElementById("enable-telemetry").checked = currentSettings.enableTelemetry;
  document.getElementById("experimental-features").checked = currentSettings.experimentalFeatures;

  // Unattended scan tab
  document.getElementById("capture-server-url").value = currentSettings.captureServerUrl;
  document.getElementById("unattended-keywords").value = currentSettings.unattendedKeywords;
  document.getElementById("unattended-locations").value = currentSettings.unattendedLocations;
  document.getElementById("unattended-date-filter").value = currentSettings.unattendedDateFilter;
  document.getElementById("unattended-remote-only").checked = currentSettings.unattendedRemoteOnly;
  document.getElementById("unattended-search-mode").value = currentSettings.unattendedSearchMode;
  document.getElementById("unattended-sort-by").value = currentSettings.unattendedSortBy;
  document.getElementById("unattended-min-salary").value = currentSettings.unattendedMinSalary || "";
  document.getElementById("unattended-easy-apply").checked = currentSettings.unattendedEasyApply;
  document.getElementById("unattended-actively-hiring").checked = currentSettings.unattendedActivelyHiring;
  document.getElementById("unattended-under-10").checked = currentSettings.unattendedUnder10Applicants;
  document.getElementById("unattended-verified").checked = currentSettings.unattendedVerifiedJobs;
  document.getElementById("unattended-company-ids").value = currentSettings.unattendedCompanyIds;
  document.getElementById("unattended-city-ids").value = currentSettings.unattendedCityIds;
  document.getElementById("unattended-pacing-profile").value = currentSettings.unattendedPacingProfile;
  document.getElementById("unattended-period-minutes").value = currentSettings.unattendedPeriodMinutes;

  setMultiCheckboxGroup("unattended-worktype-", currentSettings.unattendedWorkTypes);
  setMultiCheckboxGroup("unattended-jobtype-", currentSettings.unattendedJobTypes);
  setMultiCheckboxGroup("unattended-exp-", currentSettings.unattendedExperienceLevels);

  // Workflow profile
  document.getElementById("workflow-profile-mode").value = currentSettings.workflowProfileMode;
  document.getElementById("workflow-profile-json").value = currentSettings.workflowProfileJson;
  renderWorkflowProfileSummary(currentSettings.workflowProfile, currentSettings.workflowProfileMode);

  // Update range displays
  updateRangeDisplay("max-results", currentSettings.maxResults + " posting");
  updateRangeDisplay("premium-quota", currentSettings.premiumQuota + " companies/day");
}

// Setup form elements and event listeners
function setupFormElements() {
  // Range input displays
  const rangeInputs = document.querySelectorAll("input[type=\"range\"]");
  rangeInputs.forEach(input => {
    input.addEventListener("input", (e) => {
      const value = e.target.value;
      let displayText = value;

      if (e.target.id === "max-results") {
        displayText = value + " posting";
      } else if (e.target.id === "premium-quota") {
        displayText = value + " companies/day";
      }

      updateRangeDisplay(e.target.id, displayText);
    });
  });
}

function updateRangeDisplay(inputId, text) {
  const rangeValue = document.querySelector(`#${inputId} + .range-value`);
  if (rangeValue) {
    rangeValue.textContent = text;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Save all settings button
  document.getElementById("save-all-settings").addEventListener("click", saveAllSettings);
  document.getElementById("workflow-profile-template").addEventListener("click", loadWorkflowProfileTemplate);
  document.getElementById("workflow-profile-import").addEventListener("click", importWorkflowProfile);
  document.getElementById("workflow-profile-clear").addEventListener("click", clearWorkflowProfile);
  document.getElementById("workflow-profile-json").addEventListener("input", refreshWorkflowProfilePreviewFromTextarea);
  document.getElementById("workflow-profile-mode").addEventListener("change", refreshWorkflowProfilePreviewFromTextarea);

  // Data management buttons
  document.getElementById("export-settings").addEventListener("click", exportSettings);
  document.getElementById("import-settings").addEventListener("click", importSettings);
  document.getElementById("reset-settings").addEventListener("click", resetSettings);
  document.getElementById("clear-all-data").addEventListener("click", clearAllData);

  // Unattended scan buttons
  document.getElementById("save-unattended-scan").addEventListener("click", saveAllSettings);
  document.getElementById("start-unattended-scan").addEventListener("click", startUnattendedScan);
  document.getElementById("stop-unattended-scan").addEventListener("click", stopUnattendedScan);

  // Auto-save functionality
  const autoSaveElements = document.querySelectorAll("input, select, textarea");
  autoSaveElements.forEach(element => {
    element.addEventListener("change", () => {
      if (currentSettings.autoSaveFilters) {
        collectAndSaveSettings(false); // Don't show notification for auto-save
      }
    });
  });
}

// Collect settings from form and save
async function saveAllSettings() {
  await collectAndSaveSettings(true);
}

async function collectAndSaveSettings(showNotification = true) {
  try {
    showSaveStatus("saving", "Kaydediliyor...");

    const profileParse = profileUtils.parseWorkflowProfileInput(
      document.getElementById("workflow-profile-json").value,
    );
    if (!profileParse.ok) {
      showSaveStatus("error", "Profile JSON invalid: " + profileParse.error);
      return;
    }

    // Collect all form data
    const newSettings = normalizeSettings({
      // General
      defaultKeywords: document.getElementById("default-keywords").value.trim(),
      defaultLocation: document.getElementById("default-location").value.trim(),
      defaultProfile: document.getElementById("default-profile").value,
      autoSaveFilters: document.getElementById("auto-save-filters").checked,

      // Filters
      globalWhitelist: document.getElementById("global-whitelist").value.trim(),
      globalBlacklist: document.getElementById("global-blacklist").value.trim(),
      companyBlacklist: document.getElementById("company-blacklist").value.trim(),
      minSalaryDefault: parseInt(document.getElementById("min-salary-default").value) || null,
      excludeOutsourcingDefault: document.getElementById("exclude-outsourcing-default").checked,

      // Performance
      maxResults: parseInt(document.getElementById("max-results").value),
      premiumQuota: parseInt(document.getElementById("premium-quota").value),
      enablePremiumInsights: document.getElementById("enable-premium-insights").checked,
      autoCleanupStorage: document.getElementById("auto-cleanup-storage").checked,

      // Export
      exportFormat: document.getElementById("export-format").value,
      exportFields: {
        title: document.getElementById("export-title").checked,
        company: document.getElementById("export-company").checked,
        location: document.getElementById("export-location").checked,
        salary: document.getElementById("export-salary").checked,
        experience: document.getElementById("export-experience").checked,
        workplace: document.getElementById("export-workplace").checked,
        postedDate: document.getElementById("export-posted-date").checked,
        premiumData: document.getElementById("export-premium-data").checked,
      },
      autoFilename: document.getElementById("auto-filename").checked,

      // Namevanced
      debugMode: document.getElementById("debug-mode").value,
      enableTelemetry: document.getElementById("enable-telemetry").checked,
      experimentalFeatures: document.getElementById("experimental-features").checked,

      // Unattended scan
      captureServerUrl: document.getElementById("capture-server-url").value.trim() || "http://localhost:8766",
      unattendedKeywords: document.getElementById("unattended-keywords").value,
      unattendedLocations: document.getElementById("unattended-locations").value,
      unattendedDateFilter: document.getElementById("unattended-date-filter").value,
      unattendedRemoteOnly: document.getElementById("unattended-remote-only").checked,
      unattendedSearchMode: document.getElementById("unattended-search-mode").value,
      unattendedWorkTypes: getMultiCheckboxGroup("unattended-worktype-"),
      unattendedJobTypes: getMultiCheckboxGroup("unattended-jobtype-"),
      unattendedExperienceLevels: getMultiCheckboxGroup("unattended-exp-"),
      unattendedSortBy: document.getElementById("unattended-sort-by").value,
      unattendedMinSalary: parseInt(document.getElementById("unattended-min-salary").value) || null,
      unattendedEasyApply: document.getElementById("unattended-easy-apply").checked,
      unattendedActivelyHiring: document.getElementById("unattended-actively-hiring").checked,
      unattendedUnder10Applicants: document.getElementById("unattended-under-10").checked,
      unattendedVerifiedJobs: document.getElementById("unattended-verified").checked,
      unattendedCompanyIds: document.getElementById("unattended-company-ids").value,
      unattendedCityIds: document.getElementById("unattended-city-ids").value,
      unattendedPacingProfile: document.getElementById("unattended-pacing-profile").value,
      unattendedPeriodMinutes: parseInt(document.getElementById("unattended-period-minutes").value) || 60,

      workflowProfileMode: document.getElementById("workflow-profile-mode").value,
      workflowProfileJson: profileParse.rawText,
      workflowProfile: profileParse.profile,
    });

    // Save to storage
    await chrome.storage.local.set({ optionsSettings: newSettings });
    currentSettings = newSettings;
    renderWorkflowProfileSummary(currentSettings.workflowProfile, currentSettings.workflowProfileMode);

    if (showNotification) {
      showSaveStatus("success", "Settings saved successfully!");
    }

  } catch (error) {
    console.error("Error saving settings:", error);
    showSaveStatus("error", "Error occurred while saving");
  }
}

// Export settings to file
async function exportSettings() {
  try {
    const settings = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      settings: currentSettings,
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `job-search-workflow-capture-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showSaveStatus("success", "Settings exported");

  } catch (error) {
    console.error("Export error:", error);
    showSaveStatus("error", "Export failed");
  }
}

// Import settings from file
function importSettings() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.settings) {
        currentSettings = normalizeSettings(data.settings);
        await chrome.storage.local.set({ optionsSettings: currentSettings });
        populateFormFields();
        showSaveStatus("success", "Settings imported successfully");
      } else {
        throw new Error("Invalid settings file format");
      }

    } catch (error) {
      console.error("Import error:", error);
      showSaveStatus("error", "Import failed: " + error.message);
    }
  };

  input.click();
}

// Reset settings to defaults
async function resetSettings() {
  if (confirm("Are you sure you want to reset all settings to default values?")) {
    try {
      currentSettings = normalizeSettings(DEFAULT_SETTINGS);
      await chrome.storage.local.set({ optionsSettings: currentSettings });
      populateFormFields();
      showSaveStatus("success", "Settings reset");
    } catch (error) {
      console.error("Reset error:", error);
      showSaveStatus("error", "Resetma failed");
    }
  }
}

// Clear all extension data
async function clearAllData() {
  if (confirm("Are you sure you want to delete ALL extension data (settings, cache, telemetry)? This cannot be undone!")) {
    try {
      await chrome.storage.local.clear();
      currentSettings = normalizeSettings(DEFAULT_SETTINGS);
      populateFormFields();
      showSaveStatus("success", "All data cleared");
    } catch (error) {
      console.error("Clear data error:", error);
      showSaveStatus("error", "Veri temizleme failed");
    }
  }
}

function refreshWorkflowProfilePreviewFromTextarea() {
  const mode = document.getElementById("workflow-profile-mode").value;
  const rawText = document.getElementById("workflow-profile-json").value;
  const parsed = profileUtils.parseWorkflowProfileInput(rawText);

  if (!parsed.ok) {
    renderWorkflowProfileSummary(null, mode, parsed.error);
    return;
  }

  renderWorkflowProfileSummary(parsed.profile, mode);
}

function renderWorkflowProfileSummary(profile, mode, parseError = "") {
  const container = document.getElementById("workflow-profile-summary");
  if (!container) {
    return;
  }

  if (parseError) {
    container.innerHTML = `<p>Invalid profile JSON: ${parseError}</p>`;
    return;
  }

  const normalizedProfile = profileUtils.normalizeWorkflowProfile(profile);
  const modeLabels = {
    off: "Off",
    default_filters: "Default filterler",
    export_hints: "Export hints",
    default_filters_and_export_hints: "Default filters + export hints",
  };

  const summaryItems = [
    `Mod: ${modeLabels[mode] || modeLabels.off}`,
    `Label: ${normalizedProfile.profileLabel}`,
    `Role tracks: ${normalizedProfile.roleTracks.join(", ") || "yok"}`,
    `Keywords: ${normalizedProfile.keywords.join(", ") || "yok"}`,
    `Required keywords: ${normalizedProfile.requiredKeywords.join(", ") || "yok"}`,
    `Avoid keywords: ${normalizedProfile.avoidKeywords.join(", ") || "yok"}`,
    `Locations: ${normalizedProfile.locationPreferences.join(", ") || "yok"}`,
    `Remote only: ${normalizedProfile.remoteOnly ? "yes" : "no"}`,
    `Company origin: ${normalizedProfile.companyOrigin}`,
    `Min salary: ${normalizedProfile.minSalary ?? "yok"}`,
    `Max age days: ${normalizedProfile.maxAgeDays ?? "yok"}`,
  ];

  container.innerHTML = `<ul>${summaryItems.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function loadWorkflowProfileTemplate() {
  document.getElementById("workflow-profile-json").value = profileUtils.createWorkflowProfileTemplate();
  if (document.getElementById("workflow-profile-mode").value === profileUtils.PROFILE_MODES.OFF) {
    document.getElementById("workflow-profile-mode").value = profileUtils.PROFILE_MODES.DEFAULT_FILTERS;
  }
  refreshWorkflowProfilePreviewFromTextarea();
}

function clearWorkflowProfile() {
  document.getElementById("workflow-profile-json").value = "";
  document.getElementById("workflow-profile-mode").value = profileUtils.PROFILE_MODES.OFF;
  refreshWorkflowProfilePreviewFromTextarea();
}

function importWorkflowProfile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = profileUtils.parseWorkflowProfileInput(text);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }

      document.getElementById("workflow-profile-json").value = parsed.rawText;
      if (document.getElementById("workflow-profile-mode").value === profileUtils.PROFILE_MODES.OFF) {
        document.getElementById("workflow-profile-mode").value = profileUtils.PROFILE_MODES.DEFAULT_FILTERS;
      }
      refreshWorkflowProfilePreviewFromTextarea();
      showSaveStatus("success", "Profile imported. Don't forget to save.");
    } catch (error) {
      console.error("Profile import error:", error);
      showSaveStatus("error", "Profile import failed: " + error.message);
    }
  };

  input.click();
}

// Update performance statistics
async function updatePerformanceStats() {
  try {
    // Get telemetry data
    const response = await chrome.runtime.sendMessage({ action: "getTelemetry" });
    if (response?.success) {
      const telemetry = response.telemetry;
      document.getElementById("processed-today").textContent = telemetry.processedToday || 0;
      document.getElementById("premium-used").textContent =
                `${telemetry.premiumCallsToday || 0}/${currentSettings.premiumQuota}`;
    }

    // Get storage usage
    chrome.storage.local.getBytesInUse(null, (bytes) => {
      const mb = (bytes / (1024 * 1024)).toFixed(2);
      document.getElementById("storage-usage").textContent = `${mb} MB`;
    });

  } catch (error) {
    console.error("Error updating stats:", error);
    document.getElementById("processed-today").textContent = "Error";
    document.getElementById("premium-used").textContent = "Error";
    document.getElementById("storage-usage").textContent = "Error";
  }
}

// Update system information
function updateSystemInfo() {
  // Extension version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById("extension-version").textContent = manifest.version;

  // Browser detection
  const isChrome = /Chrome/.test(navigator.userAgent);
  const isBrave = navigator.brave !== undefined;
  let browserInfo = "Unknown";

  if (isBrave) {
    browserInfo = "Brave";
  } else if (isChrome) {
    browserInfo = "Chrome";
  }

  document.getElementById("browser-info").textContent = browserInfo;
  document.getElementById("last-update").textContent = new Date().toLocaleDateString("tr-TR");
}

// Show save status message
function showSaveStatus(type, message) {
  const statusElement = document.getElementById("save-status");
  statusElement.textContent = message;
  statusElement.className = `save-status ${type}`;

  if (type === "success" || type === "error") {
    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "save-status";
    }, 3000);
  }
}

async function startUnattendedScan() {
  try {
    await saveAllSettings();

    const keywords = currentSettings.unattendedKeywords
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const locations = currentSettings.unattendedLocations
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const companyIds = currentSettings.unattendedCompanyIds
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const cityIds = currentSettings.unattendedCityIds
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const plan = window.buildScanPlan({
      keywords,
      locations: locations.length > 0 ? locations : [""],
      dateFilters: [currentSettings.unattendedDateFilter || "r604800"],
      remoteOnly: currentSettings.unattendedRemoteOnly,
      workTypes: currentSettings.unattendedWorkTypes || [],
      jobTypes: currentSettings.unattendedJobTypes || [],
      experienceLevels: currentSettings.unattendedExperienceLevels || [],
      easyApply: currentSettings.unattendedEasyApply,
      activelyHiring: currentSettings.unattendedActivelyHiring,
      under10Applicants: currentSettings.unattendedUnder10Applicants,
      verifiedJobs: currentSettings.unattendedVerifiedJobs,
      companyIds,
      cityIds,
      minSalary: currentSettings.unattendedMinSalary || undefined,
      sortBy: currentSettings.unattendedSortBy || "DD",
      searchMode: currentSettings.unattendedSearchMode || "keyword",
      profile: currentSettings.unattendedPacingProfile || "conservative",
      captureServerUrl: currentSettings.captureServerUrl || "http://localhost:8766",
    });

    const response = await chrome.runtime.sendMessage({
      action: "startAutoScan",
      plan,
      periodInMinutes: currentSettings.unattendedPeriodMinutes || 60,
    });

    if (response?.success) {
      showUnattendedStatus("success", `Unattended scan started: ${plan.queries.length} sorgu.`);
    } else {
      showUnattendedStatus("error", "Startma failed: " + (response?.error || "Unknown error"));
    }
  } catch (error) {
    console.error("startUnattendedScan error:", error);
    showUnattendedStatus("error", "Start error: " + (error instanceof Error ? error.message : String(error)));
  }
}

async function stopUnattendedScan() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "stopAutoScan" });
    if (response?.success) {
      showUnattendedStatus("success", "Unattended scan durduruldu.");
    } else {
      showUnattendedStatus("error", "Stopma failed: " + (response?.error || "Unknown error"));
    }
  } catch (error) {
    console.error("stopUnattendedScan error:", error);
    showUnattendedStatus("error", "Stop error: " + (error instanceof Error ? error.message : String(error)));
  }
}

function showUnattendedStatus(type, message) {
  const statusElement = document.getElementById("unattended-scan-status");
  if (!statusElement) {
    return;
  }
  statusElement.textContent = message;
  statusElement.className = `status-box ${type}`;

  if (type === "success" || type === "error") {
    setTimeout(() => {
      statusElement.textContent = "";
      statusElement.className = "status-box";
    }, 5000);
  }
}

// Utility function to get current settings (can be called from other scripts)
window.getOptionsSettings = function () {
  return currentSettings;
};

// Export settings for use in popup.js
window.addEventListener("message", (event) => {
  if (event.data.type === "GET_OPTIONS_SETTINGS") {
    event.source.postMessage({
      type: "OPTIONS_SETTINGS_RESPONSE",
      settings: currentSettings,
    }, event.origin);
  }
});
