// utils/scan_planner.js
// Query matrix generator for unattended LinkedIn scan

const PACING_PROFILES = {
  conservative: {
    delayRangeMs: [6000, 10000],
    cooldownAfterBatchMs: 20000,
    batchSize: 3,
    querySpacingMs: [30000, 60000],
    scrollWaitMs: 1500,
    maxScrollCycles: 3,
  },
  balanced: {
    delayRangeMs: [4000, 6000],
    cooldownAfterBatchMs: 12000,
    batchSize: 4,
    querySpacingMs: [20000, 40000],
    scrollWaitMs: 1000,
    maxScrollCycles: 4,
  },
  aggressive: {
    delayRangeMs: [2000, 4000],
    cooldownAfterBatchMs: 8000,
    batchSize: 5,
    querySpacingMs: [10000, 20000],
    scrollWaitMs: 800,
    maxScrollCycles: 5,
  },
};

const LINKEDIN_WORK_TYPE_CODES = {
  onSite: "1",
  remote: "2",
  hybrid: "3",
};

// LinkedIn job type codes (F=Full-time, P=Part-time, C=Contract, T=Temporary,
// I=Internship, V=Volunteer, O=Other) and experience codes (1=Internship,
// 2=Entry level, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive) are
// passed through directly from the Options UI.

/**
 * Build a LinkedIn job search URL from query parameters.
 *
 * Supports both legacy keyword search and the newer AI-powered natural
 * language search (the URL parameter is still `keywords`). New filters
 * match the current LinkedIn Jobs UI: workplace type, job type, experience
 * level, Easy Apply, Actively Hiring, Under 10 applicants, Verified Jobs,
 * company/city IDs and salary. Defaults to `sortBy=DD` so the newest
 * postings are surfaced first.
 *
 * @param {Object} params
 * @param {string} params.keyword
 * @param {string} [params.location]
 * @param {string} [params.geoId]
 * @param {string} [params.dateFilter] - e.g. "r86400", "r604800", "r2592000"
 * @param {string[]} [params.workTypes] - LinkedIn codes: "1", "2", "3"
 * @param {boolean} [params.remoteOnly] - legacy shorthand for remote work type
 * @param {string[]} [params.jobTypes] - LinkedIn codes: "F", "P", "C", "T", "I", "V", "O"
 * @param {string[]} [params.experienceLevels] - LinkedIn codes: "1".."6"
 * @param {boolean} [params.easyApply]
 * @param {boolean} [params.activelyHiring]
 * @param {boolean} [params.under10Applicants]
 * @param {boolean} [params.verifiedJobs]
 * @param {string[]} [params.companyIds]
 * @param {string[]} [params.cityIds]
 * @param {number} [params.minSalary]
 * @param {string} [params.sortBy] - "DD" (newest) or "R" (relevant)
 * @returns {string}
 */
function buildLinkedInSearchUrl({
  keyword,
  location = "",
  geoId = "",
  dateFilter = "",
  workTypes = [],
  remoteOnly = false,
  jobTypes = [],
  experienceLevels = [],
  easyApply = false,
  activelyHiring = false,
  under10Applicants = false,
  verifiedJobs = false,
  companyIds = [],
  cityIds = [],
  minSalary,
  sortBy = "DD",
}) {
  const base = "https://www.linkedin.com/jobs/search/";
  const searchParams = new URLSearchParams();

  if (keyword) {
    searchParams.set("keywords", keyword);
  }

  if (location) {
    searchParams.set("location", location);
  }

  if (geoId) {
    searchParams.set("geoId", geoId);
  }

  if (dateFilter) {
    searchParams.set("f_TPR", dateFilter);
  }

  const resolvedWorkTypes = workTypes.length > 0
    ? workTypes
    : (remoteOnly ? [LINKEDIN_WORK_TYPE_CODES.remote] : []);
  if (resolvedWorkTypes.length > 0) {
    searchParams.set("f_WT", resolvedWorkTypes.join(","));
  }

  if (jobTypes.length > 0) {
    searchParams.set("f_JT", jobTypes.join(","));
  }

  if (experienceLevels.length > 0) {
    searchParams.set("f_E", experienceLevels.join(","));
  }

  if (easyApply) {
    searchParams.set("f_EA", "true");
  }

  if (activelyHiring) {
    searchParams.set("f_AL", "true");
  }

  if (under10Applicants) {
    searchParams.set("f_JIYN", "true");
  }

  if (verifiedJobs) {
    searchParams.set("f_VJ", "true");
  }

  if (companyIds.length > 0) {
    searchParams.set("f_C", companyIds.join(","));
  }

  if (cityIds.length > 0) {
    searchParams.set("f_PP", cityIds.join(","));
  }

  if (typeof minSalary === "number" && !Number.isNaN(minSalary)) {
    searchParams.set("f_SB2", String(minSalary));
  }

  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }

  const queryString = searchParams.toString();
  return queryString ? `${base}?${queryString}` : base;
}

function stableString(value) {
  if (Array.isArray(value)) {
    return value.join(",").toLowerCase().trim();
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return String(value ?? "").toLowerCase().trim();
}

function stableQueryId(payload) {
  const parts = [
    payload.keyword,
    payload.location || "",
    payload.geoId || "",
    payload.dateFilter || "",
    payload.workTypes?.length ? payload.workTypes.join(",") : (payload.remoteOnly ? "2" : ""),
    payload.jobTypes?.join(",") ?? "",
    payload.experienceLevels?.join(",") ?? "",
    payload.easyApply,
    payload.activelyHiring,
    payload.under10Applicants,
    payload.verifiedJobs,
    payload.companyIds?.join(",") ?? "",
    payload.cityIds?.join(",") ?? "",
    payload.minSalary ?? "",
    payload.sortBy ?? "DD",
  ];

  return parts.map(stableString).join("|").replace(/\s+/g, " ");
}

function resolvePacing(profile) {
  if (PACING_PROFILES[profile]) {
    return PACING_PROFILES[profile];
  }
  return PACING_PROFILES.conservative;
}

/**
 * Generate a deterministic scan plan from user settings.
 *
 * @param {Object} settings
 * @param {string[]} settings.keywords
 * @param {string[]} settings.locations
 * @param {string[]} [settings.dateFilters=["r604800"]]
 * @param {boolean} [settings.remoteOnly=false]
 * @param {string[]} [settings.workTypes=[]]
 * @param {string[]} [settings.jobTypes=[]]
 * @param {string[]} [settings.experienceLevels=[]]
 * @param {boolean} [settings.easyApply=false]
 * @param {boolean} [settings.activelyHiring=false]
 * @param {boolean} [settings.under10Applicants=false]
 * @param {boolean} [settings.verifiedJobs=false]
 * @param {string[]} [settings.companyIds=[]]
 * @param {string[]} [settings.cityIds=[]]
 * @param {number} [settings.minSalary]
 * @param {string} [settings.sortBy="DD"]
 * @param {string} [settings.searchMode="keyword"]
 * @param {string} [settings.profile="conservative"]
 * @param {string} [settings.captureServerUrl="http://localhost:8766"]
 * @returns {Object}
 */
function buildScanPlan(settings) {
  const {
    keywords = [],
    locations = [""],
    dateFilters = ["r604800"],
    remoteOnly = false,
    workTypes = [],
    jobTypes = [],
    experienceLevels = [],
    easyApply = false,
    activelyHiring = false,
    under10Applicants = false,
    verifiedJobs = false,
    companyIds = [],
    cityIds = [],
    minSalary,
    sortBy = "DD",
    searchMode = "keyword",
    profile = "conservative",
    captureServerUrl = "http://localhost:8766",
  } = settings;

  const pacing = resolvePacing(profile);
  const seen = new Set();
  const queries = [];

  for (const keyword of keywords) {
    for (const location of locations) {
      for (const dateFilter of dateFilters) {
        const payload = {
          keyword: keyword.trim(),
          location: (location || "").trim(),
          dateFilter,
          remoteOnly,
          workTypes,
          jobTypes,
          experienceLevels,
          easyApply,
          activelyHiring,
          under10Applicants,
          verifiedJobs,
          companyIds,
          cityIds,
          minSalary,
          sortBy,
        };

        const id = stableQueryId(payload);
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);

        queries.push({
          id,
          keyword: payload.keyword,
          location: payload.location,
          dateFilter,
          remoteOnly,
          workTypes,
          jobTypes,
          experienceLevels,
          easyApply,
          activelyHiring,
          under10Applicants,
          verifiedJobs,
          companyIds,
          cityIds,
          minSalary,
          sortBy,
          searchMode,
          url: buildLinkedInSearchUrl(payload),
          captureServerUrl,
        });
      }
    }
  }

  queries.sort((a, b) => a.id.localeCompare(b.id));

  return {
    queries,
    pacing,
    captureServerUrl,
    profile,
    searchMode,
    generatedAt: new Date().toISOString(),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PACING_PROFILES,
    buildLinkedInSearchUrl,
    buildScanPlan,
  };
}

if (typeof globalThis !== "undefined") {
  globalThis.PACING_PROFILES = PACING_PROFILES;
  globalThis.buildLinkedInSearchUrl = buildLinkedInSearchUrl;
  globalThis.buildScanPlan = buildScanPlan;
}

