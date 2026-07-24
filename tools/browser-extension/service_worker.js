// in-job-search-addon-chrome/service_worker.js

// Logger import (inline for service worker)
importScripts("utils/logger.js");
const logger = new Logger("ServiceWorker");

const JOB_SCAN_REQUEST = "startJobScan";
const JOB_COLLECT_ACTION = "collectJobs";

const PROFILE_SETTINGS = {
  conservative: {
    delayRangeMs: [6000, 10000],
    cooldownAfterBatchMs: 20000,
    batchSize: 3,
  },
  balanced: {
    delayRangeMs: [4000, 6000],
    cooldownAfterBatchMs: 12000,
    batchSize: 4,
  },
  aggressive: {
    delayRangeMs: [2000, 4000],
    cooldownAfterBatchMs: 8000,
    batchSize: 5,
  },
};

const PREMIUM_DAILY_LIMIT = 50;
const PREMIUM_INSIGHTS_QUERY_ID = "voyagerPremiumDashCompanyInsightsCard.9c13e41ee272f66978a821cb17d8f6fb";
const ORGANIZATION_DASH_QUERY_ID = "voyagerOrganizationDashCompanies.1164a39ce57e74d426483681eeb51d02";
const LINKEDIN_GRAPHQL_ENDPOINT = "https://www.linkedin.com/voyager/api/graphql";
const PREMIUM_INSIGHTS_STORAGE_PREFIX = "premiumInsights:";
const COMPANY_ID_CACHE_PREFIX = "premiumCompanyId:";
const PREMIUM_INSIGHTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COMPANY_ID_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const STORAGE_USAGE_THRESHOLD_BYTES = Math.floor(4.5 * 1024 * 1024);
const STORAGE_USAGE_TARGET_BYTES = Math.floor(4 * 1024 * 1024);

const jobQueue = [];
let activeJob = null;
let cooldownTimer = null;
let premiumInsightsEnabled = false;
let premiumDailyLimit = PREMIUM_DAILY_LIMIT;

const telemetry = createTelemetryState();

chrome.runtime.onInstalled.addListener(() => {
  logger.info("Service worker loaded and ready.");
  console.info("Service worker loaded and ready.");
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    logger.debug("Message received", { action: message?.action, sender: sender?.id });

    if (!message || typeof message !== "object") {
      logger.warn("Invalid message format");
      sendResponse({ success: false, error: "Invalid message format" });
      return false;
    }

    const { action } = message;

    if (action === "getTelemetry") {
      logger.debug("Telemetry request received");
      readTelemetryFromStorage().then((data) => {
        logger.debug("Telemetry read successfully", { data });
        sendResponse({ success: true, telemetry: data });
      }).catch((error) => {
        logger.error("Failed to read telemetry", { error: error.message });
        console.error("Failed to read telemetry", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return true;
    }

    if (action === "startAutoScan") {
      logger.info("Unattended scan started", { queryCount: message.plan?.queries?.length ?? 0 });
      try {
        const periodInMinutes = message.periodInMinutes ?? 60;
        await chrome.alarms.create("unattendedScan", { periodInMinutes });
        await chrome.storage.local.set({
          autoScanPlan: message.plan,
          autoScanEnabled: true,
        });
        sendResponse({ success: true });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        logger.error("startAutoScan failed", { error: messageText });
        sendResponse({ success: false, error: messageText });
      }
      return true;
    }

    if (action === "stopAutoScan") {
      logger.info("Unattended scan stopped");
      try {
        await chrome.alarms.clear("unattendedScan");
        await chrome.storage.local.set({ autoScanEnabled: false });
        sendResponse({ success: true });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        logger.error("stopAutoScan failed", { error: messageText });
        sendResponse({ success: false, error: messageText });
      }
      return true;
    }

    if (action === "getAutoScanState") {
      try {
        const stored = await chrome.storage.local.get(["autoScanPlan", "autoScanEnabled"]);
        sendResponse({
          success: true,
          state: {
            enabled: !!stored.autoScanEnabled,
            plan: stored.autoScanPlan ?? null,
          },
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        logger.error("getAutoScanState failed", { error: messageText });
        sendResponse({ success: false, error: messageText });
      }
      return true;
    }

    if (action !== JOB_SCAN_REQUEST) {
      logger.warn("Desteklenmeyen eylem", { action });
      sendResponse({ success: false, error: "Desteklenmeyen eylem: " + action });
      return false;
    }

    logger.info("Job scan request enqueued", { filters: message.filters });
    enqueueJob({ message, sendResponse, createdAt: Date.now() });
    return true;

  } catch (error) {
    logger.error("Message handler error", { error: error.message, stack: error.stack });
    console.error("Message handler error:", error);
    sendResponse({
      success: false,
      error: "Internal error: " + (error instanceof Error ? error.message : String(error)),
    });
    return false;
  }
});

function enqueueJob(job) {
  jobQueue.push(job);
  if (!activeJob && !cooldownTimer) {
    void processQueue();
  }
}

async function processQueue() {
  if (activeJob || jobQueue.length === 0) {
    return;
  }

  await ensureTelemetryInitialized();

  activeJob = jobQueue.shift() ?? null;

  if (!activeJob) {
    return;
  }

  try {
    const result = await scheduleAndHandleJob(activeJob.message);
    activeJob.sendResponse({ success: true, ...result });
    await persistTelemetry();
  } catch (error) {
    console.error("Job scan failed", error);
    activeJob.sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeJob = null;
    telemetry.lastProcessedAt = new Date().toISOString();

    if (jobQueue.length > 0) {
      const cooldownMs = getCooldownIfNeeded();
      if (cooldownMs > 0) {
        cooldownTimer = setTimeout(() => {
          cooldownTimer = null;
          void processQueue();
        }, cooldownMs);
      } else {
        void processQueue();
      }
    }
  }
}

async function scheduleAndHandleJob(request) {
  const profileKey = normalizeProfileKey(request?.filters?.profile);
  const profileSettings = PROFILE_SETTINGS[profileKey];
  const delayMs = getRandomDelay(profileSettings.delayRangeMs);

  await loadOptionsSettings();
  await sleep(delayMs);

  const result = await handleJobScan(request);

  await schedulePremiumInsights(result.jobs, profileKey);

  updateTelemetry(profileKey);

  const telemetrySnapshot = await getTelemetrySnapshot();

  return {
    ...result,
    metadata: {
      ...result.metadata,
      profile: profileKey,
      delayMs,
      throttle: {
        delayRangeMs: profileSettings.delayRangeMs,
        cooldownAfterBatchMs: profileSettings.cooldownAfterBatchMs,
        batchSize: profileSettings.batchSize,
      },
      telemetry: telemetrySnapshot,
    },
  };
}

async function handleJobScan(request) {
  const activeTab = await getActiveLinkedInTab();
  if (!activeTab?.id) {
    throw new Error("No active LinkedIn Jobs tab found.");
  }

  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: ["content/jobs.js"],
  });

  const response = await sendMessageToTab(activeTab.id, {
    action: JOB_COLLECT_ACTION,
    filters: request.filters ?? {},
  });

  return {
    jobs: Array.isArray(response?.jobs) ? response.jobs : [],
    metadata: {
      processedAt: new Date().toISOString(),
      tabId: activeTab.id,
      filters: request.filters ?? {},
      telemetry: await getTelemetrySnapshot(),
    },
  };
}

async function getActiveLinkedInTab() {
  try {
    logger.debug("Searching for active LinkedIn tab...");
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    logger.debug("Aktif sekme bulundu", { tabId: activeTab?.id, url: activeTab?.url });

    if (!activeTab) {
      logger.error("No active tab found");
      throw new Error("No active tab found. Please activate a tab.");
    }

    if (!activeTab.url) {
      logger.error("Failed to get tab URL", { tabId: activeTab.id });
      throw new Error("Failed to get tab URL. Refresh the tab and try again.");
    }

    if (!activeTab.url.includes("linkedin.com/jobs")) {
      logger.error("Not a LinkedIn Jobs page", { url: activeTab.url });
      throw new Error("Please open LinkedIn Jobs page in the active tab. Current URL: " + activeTab.url);
    }

    logger.info("LinkedIn Jobs tab verified", { tabId: activeTab.id, url: activeTab.url });
    return activeTab;
  } catch (error) {
    logger.error("LinkedIn tab check error", { error: error.message });
    console.error("LinkedIn tab check error:", error);
    throw error;
  }
}

function sendMessageToTab(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function normalizeProfileKey(profile) {
  if (typeof profile !== "string") {
    return "balanced";
  }

  if (profile in PROFILE_SETTINGS) {
    return profile;
  }

  const lowered = profile.toLowerCase();
  if (lowered in PROFILE_SETTINGS) {
    return lowered;
  }

  return "balanced";
}

function getRandomDelay([min, max]) {
  const clampedMin = Math.max(min, 0);
  const clampedMax = Math.max(max, clampedMin + 1);
  return Math.floor(Math.random() * (clampedMax - clampedMin + 1)) + clampedMin;
}

function sleep(ms) {
  if (!ms || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateTelemetry(profileKey) {
  telemetry.processedToday += 1;
  telemetry.lastProfileUsed = profileKey;
}

function getCooldownIfNeeded() {
  const profile = telemetry.lastProfileUsed ?? "balanced";
  const settings = PROFILE_SETTINGS[profile];
  if (!settings) {
    return 0;
  }

  if (telemetry.processedToday % settings.batchSize === 0) {
    return settings.cooldownAfterBatchMs;
  }

  return 0;
}

async function persistTelemetry() {
  try {
    const key = getTelemetryKey();
    const data = {
      ...telemetry,
      lastPersistedAt: new Date().toISOString(),
    };
    telemetry.lastPersistedAt = data.lastPersistedAt;
    await chrome.storage.local.set({ [key]: data });
  } catch (error) {
    console.error("Telemetry save error:", error);
    throw new Error("Telemetry could not be saved: " + error.message);
  }
}

async function readTelemetryFromStorage() {
  const key = getTelemetryKey();
  const stored = await chrome.storage.local.get([key]);
  const value = stored[key];
  if (value) {
    return normalizeTelemetry(value);
  }
  return createTelemetrySnapshot();
}

function getTelemetryKey() {
  const today = new Date();
  const datePart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return `telemetry:${datePart}`;
}

async function getTelemetrySnapshot() {
  await loadOptionsSettings();
  const stored = await readTelemetryFromStorage();
  const normalized = normalizeTelemetry(stored ?? {});
  const premiumLimit = premiumDailyLimit || PREMIUM_DAILY_LIMIT;
  const premiumUsed = normalized.premiumCallsToday ?? 0;
  const premiumRemaining = Math.max(0, premiumLimit - premiumUsed);

  return {
    ...normalized,
    premiumLimit,
    premiumRemaining,
  };
}

let telemetryInitialized = false;

async function ensureTelemetryInitialized() {
  if (telemetryInitialized) {
    return;
  }

  const stored = await readTelemetryFromStorage();
  telemetry.processedToday = stored.processedToday ?? 0;
  telemetry.lastProcessedAt = stored.lastProcessedAt ?? null;
  telemetry.lastProfileUsed = stored.lastProfileUsed ?? null;
  telemetry.premiumCallsToday = stored.premiumCallsToday ?? 0;
  telemetry.premiumCompanies = Array.isArray(stored.premiumCompanies) ? [...stored.premiumCompanies] : [];
  telemetry.premiumLastRequestAt = stored.premiumLastRequestAt ?? null;
  telemetry.lastPersistedAt = stored.lastPersistedAt ?? null;
  telemetryInitialized = true;
}

async function loadOptionsSettings() {
  try {
    const stored = await chrome.storage.local.get(["optionsSettings"]);
    const settings = stored?.optionsSettings ?? {};
    const limit = Number(settings.premiumQuota);

    premiumInsightsEnabled = settings.enablePremiumInsights === true;
    premiumDailyLimit = Number.isFinite(limit) && limit > 0 ? limit : PREMIUM_DAILY_LIMIT;
  } catch (error) {
    console.warn("Failed to load settings, using default premium limit", error);
    premiumInsightsEnabled = false;
    premiumDailyLimit = PREMIUM_DAILY_LIMIT;
  }
}

async function schedulePremiumInsights(jobs, profileKey) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return;
  }

  if (!premiumInsightsEnabled) {
    console.info("Premium Insights disabled (settings).");
    return;
  }

  const dailyLimit = premiumDailyLimit || PREMIUM_DAILY_LIMIT;
  const remainingQuota = Math.max(0, dailyLimit - (telemetry.premiumCallsToday ?? 0));
  if (remainingQuota === 0) {
    console.info("Premium Insights daily limit reached, no new requests will be made.");
    return;
  }

  const uniqueCompanies = collectUniqueCompanies(jobs);
  if (uniqueCompanies.length === 0) {
    return;
  }

  const processedSet = new Set(Array.isArray(telemetry.premiumCompanies) ? telemetry.premiumCompanies : []);
  const eligible = uniqueCompanies.filter((company) => !processedSet.has(company.key)).slice(0, remainingQuota);

  if (eligible.length === 0) {
    return;
  }

  const delayRange = PROFILE_SETTINGS[profileKey]?.delayRangeMs ?? [4000, 6000];

  for (const company of eligible) {
    const cacheHit = await hasFreshPremiumInsights(company.key);
    if (cacheHit) {
      processedSet.add(company.key);
      telemetry.premiumCompanies = Array.from(processedSet);
      continue;
    }

    try {
      const fetched = await fetchAndStorePremiumInsights(company);
      if (!fetched) {
        continue;
      }

      telemetry.premiumCallsToday += 1;
      processedSet.add(company.key);
      telemetry.premiumCompanies = Array.from(processedSet);
      telemetry.premiumLastRequestAt = new Date().toISOString();

      const delayMs = getRandomDelay(delayRange);
      await sleep(delayMs);
    } catch (error) {
      console.error("Premium Insights request failed", company, error);
    }

    if (telemetry.premiumCallsToday >= dailyLimit) {
      console.warn("Premium Insights quota exhausted.");
      break;
    }
  }
}

function collectUniqueCompanies(jobs) {
  const unique = new Map();

  jobs.forEach((job) => {
    const companyKey = buildCompanyKey(job);
    if (!companyKey) {
      return;
    }

    if (!unique.has(companyKey.key)) {
      unique.set(companyKey.key, companyKey);
    }
  });

  return Array.from(unique.values());
}

function buildCompanyKey(job) {
  if (!job) {
    return null;
  }

  const companyId = safeString(job.companyId);
  const companySlug = safeString(job.companySlug);
  const companyUrl = safeString(job.companyUrl);
  const companyName = safeString(job.company);

  if (companyId) {
    return {
      key: `id:${companyId}`,
      companyId,
      companySlug,
      companyUrl,
      companyName,
    };
  }

  if (companySlug) {
    return {
      key: `slug:${companySlug}`,
      companyId: "",
      companySlug,
      companyUrl,
      companyName,
    };
  }

  if (companyUrl) {
    const slug = extractSlugFromUrl(companyUrl);
    if (slug) {
      return {
        key: `slug:${slug}`,
        companyId: "",
        companySlug: slug,
        companyUrl,
        companyName,
      };
    }
  }

  if (companyName) {
    const normalized = companyName.toLowerCase().replace(/\s+/g, "-");
    return {
      key: `name:${normalized}`,
      companyId: "",
      companySlug: "",
      companyUrl,
      companyName,
    };
  }

  return null;
}

async function fetchAndStorePremiumInsights(company) {
  const companyId = await resolveCompanyId(company);
  if (!companyId) {
    console.warn("Company ID not found, skipping Premium Insights", company);
    return false;
  }

  const variablesParam = `(company:${companyId})`;
  const url = `${LINKEDIN_GRAPHQL_ENDPOINT}?includeWebMetadata=true&variables=${encodeURIComponent(variablesParam)}&queryId=${PREMIUM_INSIGHTS_QUERY_ID}`;

  const headers = await buildLinkedInHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Premium Insights response failed: ${response.status}`);
  }

  const payload = await response.json();
  const { metrics, raw } = extractPremiumMetrics(payload);

  await persistPremiumInsights(company.key, {
    companyId,
    companySlug: company.companySlug,
    companyName: company.companyName,
    fetchedAt: new Date().toISOString(),
    source: "premium",
    metrics,
    raw,
    expiresAt: Date.now() + PREMIUM_INSIGHTS_TTL_MS,
  });

  await ensureStorageCapacity();

  return true;
}

async function resolveCompanyId(company) {
  if (company.companyId) {
    return company.companyId;
  }

  const slug = company.companySlug;
  if (!slug) {
    return "";
  }

  const cacheKey = `${COMPANY_ID_CACHE_PREFIX}${slug}`;
  const cached = await chrome.storage.local.get([cacheKey]);
  const cachedEntry = cached?.[cacheKey];
  if (cachedEntry && !isExpired(cachedEntry.expiresAt)) {
    return String(cachedEntry.value);
  }

  const variablesParam = `(universalName:${slug})`;
  const url = `${LINKEDIN_GRAPHQL_ENDPOINT}?includeWebMetadata=true&variables=${encodeURIComponent(variablesParam)}&queryId=${ORGANIZATION_DASH_QUERY_ID}`;
  const headers = await buildLinkedInHeaders();

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    console.warn(`Company ID resolution request failed (${response.status})`, slug);
    return "";
  }

  const payload = await response.json();
  const companyUrn = findCompanyUrn(payload);
  const resolvedId = extractCompanyIdFromUrn(companyUrn);

  if (resolvedId) {
    await chrome.storage.local.set({
      [cacheKey]: {
        value: resolvedId,
        expiresAt: Date.now() + COMPANY_ID_TTL_MS,
      },
    });
    await ensureStorageCapacity();
    return resolvedId;
  }

  return "";
}

function extractCompanyIdFromUrn(urn) {
  if (!urn || typeof urn !== "string") {
    return "";
  }

  const match = urn.match(/urn:li:(?:organization|company):(?<id>\d+)/i);
  if (match?.groups?.id) {
    return match.groups.id;
  }

  return "";
}

async function buildLinkedInHeaders() {
  const headers = new Headers();
  headers.set("accept", "application/vnd.linkedin.normalized+json+2.1");
  headers.set("x-restli-protocol-version", "2.0.0");

  const csrfToken = await getCsrfToken();
  if (csrfToken) {
    headers.set("csrf-token", csrfToken);
  }

  return headers;
}

async function getCsrfToken() {
  try {
    const cookie = await chrome.cookies.get({
      url: "https://www.linkedin.com",
      name: "JSESSIONID",
    });

    if (!cookie?.value) {
      return "";
    }

    return cookie.value.replace(/"/g, "");
  } catch (error) {
    console.warn("Failed to get CSRF token", error);
    return "";
  }
}

function extractSlugFromUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/company\/([^/?#]+)/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  } catch (error) {
    console.debug("Slug extraction failed", error);
  }

  return "";
}

function findCompanyUrn(payload) {
  const stack = [payload];
  const visited = new Set();

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => stack.push(item));
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === "string" && value.includes("urn:li:company:")) {
        return value;
      }

      if (typeof key === "string" && key.includes("urn:li:company:")) {
        return key;
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return "";
}

async function persistPremiumInsights(companyKey, payload) {
  if (!companyKey) {
    return;
  }

  const key = `${PREMIUM_INSIGHTS_STORAGE_PREFIX}${companyKey}`;
  await chrome.storage.local.set({ [key]: payload });
}

async function ensureStorageCapacity() {
  try {
    const usage = await new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(bytes);
      });
    });

    if (usage < STORAGE_USAGE_THRESHOLD_BYTES) {
      return;
    }

    await cleanupExpiredEntries();

    const afterCleanupUsage = await new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(bytes);
      });
    });

    if (afterCleanupUsage <= STORAGE_USAGE_TARGET_BYTES) {
      return;
    }

    await prunePremiumInsights(afterCleanupUsage);
  } catch (error) {
    console.warn("Error during storage capacity check", error);
  }
}

async function cleanupExpiredEntries() {
  const allKeys = await new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(items);
    });
  });

  const removals = [];
  Object.entries(allKeys).forEach(([key, value]) => {
    if (key.startsWith(PREMIUM_INSIGHTS_STORAGE_PREFIX)) {
      if (isExpired(value?.expiresAt)) {
        removals.push(key);
      }
    }

    if (key.startsWith(COMPANY_ID_CACHE_PREFIX)) {
      if (isExpired(value?.expiresAt)) {
        removals.push(key);
      }
    }
  });

  if (removals.length > 0) {
    await chrome.storage.local.remove(removals);
  }
}

async function prunePremiumInsights(currentUsage) {
  const items = await new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (entries) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(entries);
    });
  });

  const candidates = Object.entries(items)
    .filter(([key]) => key.startsWith(PREMIUM_INSIGHTS_STORAGE_PREFIX))
    .map(([key, value]) => {
      const fetchedAt = Date.parse(value?.fetchedAt ?? 0) || 0;
      return {
        key,
        fetchedAt,
      };
    })
    .sort((a, b) => a.fetchedAt - b.fetchedAt);

  if (candidates.length === 0) {
    return;
  }

  let usage = currentUsage;
  const toRemove = [];

  for (const candidate of candidates) {
    if (usage <= STORAGE_USAGE_TARGET_BYTES) {
      break;
    }

    toRemove.push(candidate.key);
    usage -= estimatedEntrySize(items[candidate.key]);
  }

  if (toRemove.length > 0) {
    await chrome.storage.local.remove(toRemove);
  }
}

function estimatedEntrySize(entry) {
  try {
    const serialized = JSON.stringify(entry);
    return serialized ? serialized.length * 2 : 0;
  } catch (_error) {
    return 0;
  }
}

function extractPremiumMetrics(payload) {
  if (!payload) {
    return {
      metrics: {
        totalEmployees: null,
        medianTenure: null,
        growth: {
          sixMonth: null,
          oneYear: null,
          twoYear: null,
        },
        chartData: null,
      },
      raw: payload,
    };
  }

  const metrics = {
    totalEmployees: null,
    medianTenure: null,
    growth: {
      sixMonth: null,
      oneYear: null,
      twoYear: null,
    },
    chartData: null,
  };

  const visited = new Set();
  const stack = [payload];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== "object") {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      if (!metrics.chartData && current.every((item) => typeof item === "number" || (item && typeof item === "object"))) {
        metrics.chartData = current;
      }

      current.forEach((item) => {
        stack.push(item);
      });
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === "number") {
        const normalizedKey = key.toLowerCase();
        if (metrics.totalEmployees === null && normalizedKey.includes("total") && normalizedKey.includes("employee")) {
          metrics.totalEmployees = value;
        }

        if (normalizedKey.includes("six") && normalizedKey.includes("month") && metrics.growth.sixMonth === null) {
          metrics.growth.sixMonth = value;
        }

        if ((normalizedKey.includes("one") && normalizedKey.includes("year")) || normalizedKey.includes("12month")) {
          if (metrics.growth.oneYear === null) {
            metrics.growth.oneYear = value;
          }
        }

        if (normalizedKey.includes("two") && normalizedKey.includes("year")) {
          if (metrics.growth.twoYear === null) {
            metrics.growth.twoYear = value;
          }
        }
      }

      if (typeof value === "string") {
        const normalizedKey = key.toLowerCase();
        if (metrics.medianTenure === null && normalizedKey.includes("median") && normalizedKey.includes("tenure")) {
          metrics.medianTenure = value;
        }

        if (metrics.totalEmployees === null && normalizedKey.includes("total") && normalizedKey.includes("employee")) {
          const numeric = parseNumberFromText(value);
          if (numeric !== null) {
            metrics.totalEmployees = numeric;
          }
        }

        if (normalizedKey.includes("six") && normalizedKey.includes("month") && metrics.growth.sixMonth === null) {
          const parsed = parseNumberFromText(value);
          if (parsed !== null) {
            metrics.growth.sixMonth = parsed;
          }
        }

        if ((normalizedKey.includes("one") && normalizedKey.includes("year")) || normalizedKey.includes("12month")) {
          if (metrics.growth.oneYear === null) {
            const parsed = parseNumberFromText(value);
            if (parsed !== null) {
              metrics.growth.oneYear = parsed;
            }
          }
        }

        if (normalizedKey.includes("two") && normalizedKey.includes("year")) {
          if (metrics.growth.twoYear === null) {
            const parsed = parseNumberFromText(value);
            if (parsed !== null) {
              metrics.growth.twoYear = parsed;
            }
          }
        }
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return {
    metrics,
    raw: payload,
  };
}

function parseNumberFromText(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[0]);
  if (Number.isNaN(value)) {
    return null;
  }

  return value;
}

function safeString(value) {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

async function hasFreshPremiumInsights(companyKey) {
  if (!companyKey) {
    return false;
  }

  const key = `${PREMIUM_INSIGHTS_STORAGE_PREFIX}${companyKey}`;
  const stored = await chrome.storage.local.get([key]);
  const entry = stored?.[key];
  if (!entry) {
    return false;
  }

  if (isExpired(entry.expiresAt)) {
    await chrome.storage.local.remove(key);
    return false;
  }

  return true;
}

function createTelemetryState() {
  return {
    processedToday: 0,
    lastProcessedAt: null,
    lastProfileUsed: null,
    premiumCallsToday: 0,
    premiumCompanies: [],
    premiumLastRequestAt: null,
    lastPersistedAt: null,
  };
}

function createTelemetrySnapshot() {
  const snapshot = createTelemetryState();
  snapshot.premiumCompanies = [];
  return snapshot;
}

function normalizeTelemetry(value) {
  if (!value || typeof value !== "object") {
    return createTelemetrySnapshot();
  }

  const defaults = createTelemetrySnapshot();
  return {
    ...defaults,
    ...value,
    premiumCompanies: Array.isArray(value.premiumCompanies) ? [...value.premiumCompanies] : [],
  };
}

function isExpired(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const timestamp = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
  if (Number.isNaN(timestamp)) {
    return true;
  }

  return Date.now() > timestamp;
}

if (typeof chrome !== "undefined" && chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "unattendedScan") {
      return;
    }

    logger.info("Unattended scan alarm fired");

    let stored;
    try {
      stored = await chrome.storage.local.get(["autoScanPlan", "autoScanEnabled"]);
    } catch (error) {
      logger.error("Failed to read scan state", { error: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (!stored.autoScanEnabled || !stored.autoScanPlan) {
      logger.info("No active scan plan; skipping alarm");
      return;
    }

    const plan = stored.autoScanPlan;
    const currentIndex = plan.currentQueryIndex ?? 0;
    const currentQuery = plan.queries?.[currentIndex];

    if (!currentQuery) {
      logger.warn("No current query in scan plan");
      return;
    }

    let tab;
    try {
      const linkedInTabs = await chrome.tabs.query({ url: "https://www.linkedin.com/jobs/*" });
      if (linkedInTabs && linkedInTabs.length > 0) {
        tab = linkedInTabs[0];
      } else {
        tab = await chrome.tabs.create({ url: currentQuery.url, active: false });
      }
    } catch (error) {
      logger.error("Failed to open LinkedIn tab", { error: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (!tab?.id) {
      logger.error("No tab id available");
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/autoscan.js"],
      });
    } catch (error) {
      logger.error("Failed to inject autoscan content script", { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: "startAutoScan",
        plan: { ...plan, queries: [currentQuery] },
      });
    } catch (error) {
      logger.error("Failed to send startAutoScan to tab", { error: error instanceof Error ? error.message : String(error) });
    }

    const nextIndex = (currentIndex + 1) % plan.queries.length;
    try {
      await chrome.storage.local.set({
        autoScanPlan: { ...plan, currentQueryIndex: nextIndex },
      });
    } catch (error) {
      logger.error("Failed to update scan index", { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

