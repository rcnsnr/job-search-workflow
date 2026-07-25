const {
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
} = require("../utils/workflow_profile");

describe("Workflow profile helpers", () => {
  test("createWorkflowProfileTemplate returns valid JSON", () => {
    const parsed = JSON.parse(createWorkflowProfileTemplate());
    expect(parsed.profileLabel).toBe("Example Workflow Profile");
    expect(Array.isArray(parsed.keywords)).toBe(true);
  });

  test("parseWorkflowProfileInput normalizes valid JSON", () => {
    const parsed = parseWorkflowProfileInput(JSON.stringify({
      profileLabel: "  My Profile  ",
      roleTracks: ["sre_platform", "sre_platform", "dual_track"],
      keywords: ["platform", "platform", " ai "],
      requiredKeywords: ["platform"],
      avoidKeywords: ["onsite-only"],
      locationPreferences: ["Remote", "Europe"],
      remoteOnly: true,
      companyOrigin: "exclude-outsourcing",
      minSalary: 90000,
      maxAgeDays: 7,
      preferredScanProfile: "balanced",
    }));

    expect(parsed.ok).toBe(true);
    expect(parsed.profile.profileLabel).toBe("My Profile");
    expect(parsed.profile.roleTracks).toEqual(["sre_platform", "dual_track"]);
    expect(parsed.profile.keywords).toEqual(["platform", "ai"]);
    expect(parsed.profile.remoteOnly).toBe(true);
  });

  test("parseWorkflowProfileInput rejects invalid JSON", () => {
    const parsed = parseWorkflowProfileInput("{bad json");
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBeTruthy();
  });

  test("profile mode helpers work", () => {
    expect(profileModeUsesDefaultFilters(PROFILE_MODES.DEFAULT_FILTERS)).toBe(true);
    expect(profileModeUsesDefaultFilters(PROFILE_MODES.EXPORT_HINTS)).toBe(false);
    expect(profileModeUsesExportHints(PROFILE_MODES.EXPORT_HINTS)).toBe(true);
    expect(profileModeUsesExportHints(PROFILE_MODES.OFF)).toBe(false);
  });

  test("buildFilterDefaultsFromOptions maps option defaults", () => {
    const defaults = buildFilterDefaultsFromOptions({
      defaultKeywords: "platform, sre",
      defaultLocation: "Remote, Europe",
      defaultProfile: "aggressive",
      globalWhitelist: "platform\nreliability",
      globalBlacklist: "intern\nonsite",
      minSalaryDefault: 75000,
      excludeOutsourcingDefault: true,
    });

    expect(defaults.keywords).toBe("platform, sre");
    expect(defaults.location).toBe("Remote, Europe");
    expect(defaults.profile).toBe("aggressive");
    expect(defaults.keywordWhitelist).toEqual(["platform", "reliability"]);
    expect(defaults.keywordBlacklist).toEqual(["intern", "onsite"]);
    expect(defaults.companyOrigin).toBe("exclude-outsourcing");
    expect(defaults.minSalary).toBe(75000);
  });

  test("buildFilterDefaultsFromProfile maps structured profile into popup defaults", () => {
    const defaults = buildFilterDefaultsFromProfile({
      keywords: ["platform", "agent"],
      requiredKeywords: ["platform"],
      avoidKeywords: ["onsite-only"],
      locationPreferences: ["Remote", "Europe"],
      remoteOnly: true,
      companyOrigin: "exclude-outsourcing",
      minSalary: null,
      maxAgeDays: 10,
      preferredScanProfile: "balanced",
      preferredSeniority: ["Senior", "Staff"],
    });

    expect(defaults.keywords).toBe("platform, agent");
    expect(defaults.location).toBe("Remote, Europe");
    expect(defaults.keywordWhitelist).toEqual(["platform"]);
    expect(defaults.keywordBlacklist).toEqual(["onsite-only"]);
    expect(defaults.remoteOnly).toBe(true);
    expect(defaults.maxAgeDays).toBe(10);
    expect(defaults.experience).toBe("Senior, Staff");
  });

  test("resolvePopupFilters applies option defaults and profile defaults before stored filters", () => {
    const filters = resolvePopupFilters({
      keywords: "custom keyword",
      location: "Berlin",
      profile: "conservative",
    }, {
      defaultKeywords: "default keyword",
      defaultLocation: "Remote",
      defaultProfile: "aggressive",
      globalWhitelist: "platform",
      workflowProfileMode: PROFILE_MODES.DEFAULT_FILTERS,
      workflowProfile: {
        keywords: ["profile keyword"],
        locationPreferences: ["Europe"],
        remoteOnly: true,
      },
    });

    expect(filters.keywords).toBe("custom keyword");
    expect(filters.location).toBe("Berlin");
    expect(filters.profile).toBe("conservative");
    expect(filters.keywordWhitelist).toEqual(["platform"]);
    expect(filters.remoteOnly).toBe(true);
  });

  test("resolvePopupFilters lets explicit stored empties override defaults", () => {
    const filters = resolvePopupFilters({
      keywords: "",
      location: "",
      keywordWhitelist: [],
      keywordBlacklist: [],
      minSalary: null,
      remoteOnly: false,
      maxAgeDays: null,
    }, {
      defaultKeywords: "default keyword",
      defaultLocation: "Remote",
      minSalaryDefault: 90000,
      workflowProfileMode: PROFILE_MODES.DEFAULT_FILTERS,
      workflowProfile: {
        keywords: ["profile keyword"],
        requiredKeywords: ["platform"],
        avoidKeywords: ["onsite"],
        remoteOnly: true,
        maxAgeDays: 14,
      },
    });

    expect(filters.keywords).toBe("");
    expect(filters.location).toBe("");
    expect(filters.keywordWhitelist).toEqual([]);
    expect(filters.keywordBlacklist).toEqual([]);
    expect(filters.minSalary).toBeNull();
    expect(filters.remoteOnly).toBe(false);
    expect(filters.maxAgeDays).toBeNull();
  });

  test("evaluateJobAgainstWorkflowProfile returns strong match when signals align", () => {
    const result = evaluateJobAgainstWorkflowProfile({
      title: "Senior Platform Reliability Engineer",
      description: "Remote role for platform, reliability and observability work.",
      location: "Remote - Europe",
      companyOrigin: "direct",
    }, {
      profileLabel: "Core Profile",
      keywords: ["platform", "observability"],
      requiredKeywords: ["platform"],
      locationPreferences: ["Europe"],
      remoteOnly: true,
      companyOrigin: "exclude-outsourcing",
    });

    expect(result.fitLabel).toBe("strong_match");
    expect(result.reasons.join(" ")).toContain("matched keywords");
    expect(result.profileLabel).toBe("Core Profile");
  });

  test("evaluateJobAgainstWorkflowProfile returns low or mixed match for conflicts", () => {
    const result = evaluateJobAgainstWorkflowProfile({
      title: "Onsite Sales Manager",
      description: "Office-based sales role",
      location: "On-site / London",
      companyOrigin: "outsourcing",
    }, {
      requiredKeywords: ["platform"],
      avoidKeywords: ["sales"],
      remoteOnly: true,
      companyOrigin: "exclude-outsourcing",
    });

    expect(["low_match", "mixed_match"]).toContain(result.fitLabel);
    expect(result.risks.length).toBeGreaterThan(0);
  });

  test("normalizeWorkflowProfile drops unsupported or duplicate values", () => {
    const profile = normalizeWorkflowProfile({
      roleTracks: ["sre_platform", "bad", "sre_platform"],
      workModelPreferences: ["remote", "remote", "weird"],
      companyOrigin: "invalid",
      preferredScanProfile: "invalid",
    });

    expect(profile.roleTracks).toEqual(["sre_platform"]);
    expect(profile.workModelPreferences).toEqual(["remote"]);
    expect(profile.companyOrigin).toBe("any");
    expect(profile.preferredScanProfile).toBe("balanced");
  });
});
