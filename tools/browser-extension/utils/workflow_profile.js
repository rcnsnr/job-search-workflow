(function (globalTarget) {
  const PROFILE_MODES = {
    OFF: "off",
    DEFAULT_FILTERS: "default_filters",
    EXPORT_HINTS: "export_hints",
    DEFAULTS_AND_EXPORT_HINTS: "default_filters_and_export_hints",
  };

  const ALLOWED_ROLE_TRACKS = new Set([
    "sre_platform",
    "ai_native_builder",
    "dual_track",
    "reject_candidate",
  ]);
  const ALLOWED_COMPANY_ORIGINS = new Set([
    "any",
    "direct",
    "exclude-outsourcing",
    "outsourcing",
  ]);
  const ALLOWED_SCAN_PROFILES = new Set([
    "conservative",
    "balanced",
    "aggressive",
  ]);
  const ALLOWED_WORK_MODE_PREFERENCES = new Set([
    "remote",
    "hybrid",
    "onsite",
    "Unknown",
  ]);

  function normalizeWhitespace(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.replace(/\s+/g, " ").trim();
  }

  function normalizeStringArray(value, maxItems = 20) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    const result = [];

    list.forEach((item) => {
      const normalized = normalizeWhitespace(item);
      const key = normalized.toLowerCase();
      if (normalized && !seen.has(key) && result.length < maxItems) {
        seen.add(key);
        result.push(normalized);
      }
    });

    return result;
  }

  function normalizeBoolean(value, fallback = false) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value.toLowerCase() === "true") {
        return true;
      }
      if (value.toLowerCase() === "false") {
        return false;
      }
    }

    return fallback;
  }

  function normalizeNullableNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function normalizeEnum(value, allowedValues, fallback) {
    return allowedValues.has(value) ? value : fallback;
  }

  function profileModeUsesDefaultFilters(mode) {
    return mode === PROFILE_MODES.DEFAULT_FILTERS || mode === PROFILE_MODES.DEFAULTS_AND_EXPORT_HINTS;
  }

  function profileModeUsesExportHints(mode) {
    return mode === PROFILE_MODES.EXPORT_HINTS || mode === PROFILE_MODES.DEFAULTS_AND_EXPORT_HINTS;
  }

  function normalizeWorkflowProfile(rawProfile) {
    const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};

    return {
      profileLabel: normalizeWhitespace(profile.profileLabel) || "Example Workflow Profile",
      roleTracks: normalizeStringArray(profile.roleTracks, 6).filter((item) => ALLOWED_ROLE_TRACKS.has(item)),
      keywords: normalizeStringArray(profile.keywords),
      requiredKeywords: normalizeStringArray(profile.requiredKeywords),
      avoidKeywords: normalizeStringArray(profile.avoidKeywords),
      locationPreferences: normalizeStringArray(profile.locationPreferences, 10),
      remoteOnly: normalizeBoolean(profile.remoteOnly, false),
      workModelPreferences: normalizeStringArray(profile.workModelPreferences, 4).filter((item) => ALLOWED_WORK_MODE_PREFERENCES.has(item)),
      companyOrigin: normalizeEnum(profile.companyOrigin, ALLOWED_COMPANY_ORIGINS, "any"),
      minSalary: normalizeNullableNumber(profile.minSalary),
      maxAgeDays: normalizeNullableNumber(profile.maxAgeDays),
      preferredScanProfile: normalizeEnum(profile.preferredScanProfile, ALLOWED_SCAN_PROFILES, "balanced"),
      preferredSeniority: normalizeStringArray(profile.preferredSeniority, 8),
      preferredEmploymentTypes: normalizeStringArray(profile.preferredEmploymentTypes, 4),
    };
  }

  function parseWorkflowProfileInput(rawInput) {
    const text = normalizeWhitespace(rawInput);
    if (!text) {
      return {
        ok: true,
        profile: normalizeWorkflowProfile({}),
        rawText: "",
      };
    }

    try {
      const parsed = JSON.parse(rawInput);
      return {
        ok: true,
        profile: normalizeWorkflowProfile(parsed),
        rawText: JSON.stringify(normalizeWorkflowProfile(parsed), null, 2),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function createWorkflowProfileTemplate() {
    return JSON.stringify({
      profileLabel: "Example Workflow Profile",
      roleTracks: ["sre_platform", "dual_track"],
      keywords: ["platform", "reliability", "observability", "agent", "developer productivity"],
      requiredKeywords: ["platform"],
      avoidKeywords: ["onsite-only", "commission"],
      locationPreferences: ["Remote", "Europe"],
      remoteOnly: true,
      workModelPreferences: ["remote", "hybrid"],
      companyOrigin: null,
      minSalary: null,
      maxAgeDays: null,
      preferredScanProfile: "balanced",
      preferredSeniority: ["Senior", "Staff"],
      preferredEmploymentTypes: ["full_time"],
      note: "This is a fictitious example. Replace all values with your own verified preferences.",
    }, null, 2);
  }

  function buildFilterDefaultsFromOptions(settings) {
    const source = settings && typeof settings === "object" ? settings : {};

    return {
      keywords: normalizeWhitespace(source.defaultKeywords),
      location: normalizeWhitespace(source.defaultLocation),
      company: "",
      experience: "",
      industry: "",
      keywordWhitelist: normalizeStringArray(String(source.globalWhitelist || "").split(/\r?\n/)),
      keywordBlacklist: normalizeStringArray(String(source.globalBlacklist || "").split(/\r?\n/)),
      companyOrigin: source.excludeOutsourcingDefault ? "exclude-outsourcing" : "any",
      minSalary: normalizeNullableNumber(source.minSalaryDefault),
      profile: normalizeEnum(source.defaultProfile, ALLOWED_SCAN_PROFILES, "balanced"),
      remoteOnly: false,
      maxAgeDays: null,
    };
  }

  function buildFilterDefaultsFromProfile(profile) {
    const normalized = normalizeWorkflowProfile(profile);

    return {
      keywords: normalized.keywords.join(", "),
      location: normalized.locationPreferences.join(", "),
      company: "",
      experience: normalized.preferredSeniority.join(", "),
      industry: "",
      keywordWhitelist: normalized.requiredKeywords,
      keywordBlacklist: normalized.avoidKeywords,
      companyOrigin: normalized.companyOrigin,
      minSalary: normalized.minSalary,
      profile: normalized.preferredScanProfile,
      remoteOnly: normalized.remoteOnly,
      maxAgeDays: normalized.maxAgeDays,
    };
  }

  function hasOwn(objectValue, key) {
    return Boolean(objectValue) && Object.prototype.hasOwnProperty.call(objectValue, key);
  }

  function normalizeStoredStringOverride(source, key, fallbackValue) {
    if (!hasOwn(source, key)) {
      return fallbackValue;
    }

    return normalizeWhitespace(source[key]);
  }

  function normalizeStoredArrayOverride(source, key, fallbackValue) {
    if (!hasOwn(source, key)) {
      return fallbackValue;
    }

    return normalizeStringArray(source[key]);
  }

  function normalizeStoredEnumOverride(source, key, allowedValues, fallbackValue) {
    if (!hasOwn(source, key)) {
      return fallbackValue;
    }

    return normalizeEnum(source[key], allowedValues, fallbackValue);
  }

  function normalizeStoredNullableNumberOverride(source, key, fallbackValue) {
    if (!hasOwn(source, key)) {
      return fallbackValue;
    }

    return normalizeNullableNumber(source[key]);
  }

  function normalizeStoredBooleanOverride(source, key, fallbackValue) {
    if (!hasOwn(source, key)) {
      return fallbackValue;
    }

    return normalizeBoolean(source[key], false);
  }

  function mergeFilterDefaults(baseFilters, overrideFilters, options = {}) {
    const base = baseFilters && typeof baseFilters === "object" ? baseFilters : {};
    const override = overrideFilters && typeof overrideFilters === "object" ? overrideFilters : {};
    const explicitOverride = options.explicitOverride === true;

    if (explicitOverride) {
      return {
        keywords: normalizeStoredStringOverride(override, "keywords", normalizeWhitespace(base.keywords)),
        location: normalizeStoredStringOverride(override, "location", normalizeWhitespace(base.location)),
        company: normalizeStoredStringOverride(override, "company", normalizeWhitespace(base.company)),
        experience: normalizeStoredStringOverride(override, "experience", normalizeWhitespace(base.experience)),
        industry: normalizeStoredStringOverride(override, "industry", normalizeWhitespace(base.industry)),
        keywordWhitelist: normalizeStoredArrayOverride(override, "keywordWhitelist", normalizeStringArray(base.keywordWhitelist)),
        keywordBlacklist: normalizeStoredArrayOverride(override, "keywordBlacklist", normalizeStringArray(base.keywordBlacklist)),
        companyOrigin: normalizeStoredEnumOverride(
          override,
          "companyOrigin",
          ALLOWED_COMPANY_ORIGINS,
          normalizeEnum(base.companyOrigin, ALLOWED_COMPANY_ORIGINS, "any"),
        ),
        minSalary: normalizeStoredNullableNumberOverride(override, "minSalary", normalizeNullableNumber(base.minSalary)),
        profile: normalizeStoredEnumOverride(
          override,
          "profile",
          ALLOWED_SCAN_PROFILES,
          normalizeEnum(base.profile, ALLOWED_SCAN_PROFILES, "balanced"),
        ),
        remoteOnly: normalizeStoredBooleanOverride(override, "remoteOnly", normalizeBoolean(base.remoteOnly, false)),
        maxAgeDays: normalizeStoredNullableNumberOverride(override, "maxAgeDays", normalizeNullableNumber(base.maxAgeDays)),
      };
    }

    return {
      keywords: normalizeWhitespace(override.keywords) || normalizeWhitespace(base.keywords),
      location: normalizeWhitespace(override.location) || normalizeWhitespace(base.location),
      company: normalizeWhitespace(override.company) || normalizeWhitespace(base.company),
      experience: normalizeWhitespace(override.experience) || normalizeWhitespace(base.experience),
      industry: normalizeWhitespace(override.industry) || normalizeWhitespace(base.industry),
      keywordWhitelist: Array.isArray(override.keywordWhitelist) && override.keywordWhitelist.length > 0
        ? normalizeStringArray(override.keywordWhitelist)
        : normalizeStringArray(base.keywordWhitelist),
      keywordBlacklist: Array.isArray(override.keywordBlacklist) && override.keywordBlacklist.length > 0
        ? normalizeStringArray(override.keywordBlacklist)
        : normalizeStringArray(base.keywordBlacklist),
      companyOrigin: normalizeEnum(override.companyOrigin, ALLOWED_COMPANY_ORIGINS, normalizeEnum(base.companyOrigin, ALLOWED_COMPANY_ORIGINS, "any")),
      minSalary: normalizeNullableNumber(override.minSalary) ?? normalizeNullableNumber(base.minSalary),
      profile: normalizeEnum(override.profile, ALLOWED_SCAN_PROFILES, normalizeEnum(base.profile, ALLOWED_SCAN_PROFILES, "balanced")),
      remoteOnly: typeof override.remoteOnly === "boolean" ? override.remoteOnly : normalizeBoolean(base.remoteOnly, false),
      maxAgeDays: normalizeNullableNumber(override.maxAgeDays) ?? normalizeNullableNumber(base.maxAgeDays),
    };
  }

  function resolvePopupFilters(storedFilters, optionsSettings) {
    const settings = optionsSettings && typeof optionsSettings === "object" ? optionsSettings : {};
    const normalizedProfileMode = normalizeEnum(
      settings.workflowProfileMode,
      new Set(Object.values(PROFILE_MODES)),
      PROFILE_MODES.OFF,
    );

    let resolved = buildFilterDefaultsFromOptions(settings);

    if (profileModeUsesDefaultFilters(normalizedProfileMode)) {
      resolved = mergeFilterDefaults(resolved, buildFilterDefaultsFromProfile(settings.workflowProfile));
    }

    return mergeFilterDefaults(resolved, storedFilters, { explicitOverride: true });
  }

  function buildJobSearchText(job) {
    const parts = [
      normalizeWhitespace(job?.title),
      normalizeWhitespace(job?.company),
      normalizeWhitespace(job?.location),
      normalizeWhitespace(job?.workplaceType),
      normalizeWhitespace(job?.description),
      normalizeWhitespace(job?.experienceLevel),
      Array.isArray(job?.industries) ? job.industries.join(" ") : "",
      normalizeWhitespace(job?.companyOrigin),
    ];

    return parts.join(" ").toLowerCase();
  }

  function evaluateJobAgainstWorkflowProfile(job, profile) {
    const normalizedProfile = normalizeWorkflowProfile(profile);
    const text = buildJobSearchText(job);
    const matchedKeywords = normalizedProfile.keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
    const missingRequiredKeywords = normalizedProfile.requiredKeywords.filter((keyword) => !text.includes(keyword.toLowerCase()));
    const blockedKeywords = normalizedProfile.avoidKeywords.filter((keyword) => text.includes(keyword.toLowerCase()));
    const locationMatches = normalizedProfile.locationPreferences.filter((item) => text.includes(item.toLowerCase()));

    let fitLabel = "neutral";
    const reasons = [];
    const risks = [];

    if (matchedKeywords.length > 0) {
      reasons.push(`matched keywords: ${matchedKeywords.join(", ")}`);
    }
    if (locationMatches.length > 0) {
      reasons.push(`matched locations: ${locationMatches.join(", ")}`);
    }
    if (normalizedProfile.remoteOnly && /remote/.test(text)) {
      reasons.push("remote-compatible signal present");
    }

    if (missingRequiredKeywords.length > 0) {
      risks.push(`missing required keywords: ${missingRequiredKeywords.join(", ")}`);
    }
    if (blockedKeywords.length > 0) {
      risks.push(`blocked keywords: ${blockedKeywords.join(", ")}`);
    }
    if (normalizedProfile.remoteOnly && /on-site|onsite|on site|office/.test(text)) {
      risks.push("remote-only profile conflicts with onsite signal");
    }
    if (normalizedProfile.companyOrigin === "exclude-outsourcing" && normalizeWhitespace(job?.companyOrigin) === "outsourcing") {
      risks.push("company origin conflicts with outsourcing exclusion");
    }

    if (risks.length === 0 && (matchedKeywords.length > 0 || locationMatches.length > 0)) {
      fitLabel = "strong_match";
    } else if (reasons.length > 0 && risks.length > 0) {
      fitLabel = "mixed_match";
    } else if (risks.length > 0) {
      fitLabel = "low_match";
    }

    return {
      fitLabel,
      reasons,
      risks,
      matchedKeywords,
      missingRequiredKeywords,
      blockedKeywords,
      locationMatches,
      profileLabel: normalizedProfile.profileLabel,
    };
  }

  const api = {
    PROFILE_MODES,
    normalizeWorkflowProfile,
    parseWorkflowProfileInput,
    createWorkflowProfileTemplate,
    profileModeUsesDefaultFilters,
    profileModeUsesExportHints,
    buildFilterDefaultsFromOptions,
    buildFilterDefaultsFromProfile,
    resolvePopupFilters,
    evaluateJobAgainstWorkflowProfile,
  };

  globalTarget.WorkflowProfileUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
