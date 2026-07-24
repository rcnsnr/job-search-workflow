(function (globalTarget) {
  const DEFAULT_SOURCE_ID = "linkedin-manual-extension";
  const DEFAULT_SOURCE_FAMILY = "linkedin_manual_extension_capture";
  const DEFAULT_CAPTURE_METHOD = "manual_browser_extension_export";
  const DEFAULT_SOURCE_POLICY_STATE = "discovery_only";
  const DEFAULT_DECISION_HANDOFF_STATE = "pending_triage";
  const DEFAULT_NORMALIZED_STATUS = "new";
  const DEFAULT_WATCH_TIER = "discovery_only";
  const LINKEDIN_FALLBACK_URL = "https://www.linkedin.com/jobs/";
  const DESCRIPTION_SNIPPET_LIMIT = 320;
  const NOTES_LIMIT = 240;

  // Default keywords for role track inference. Users can configure their own
  // filtering keywords via the Profile JSON in the Options UI; these defaults
  // are used only for export tagging when no profile keywords are provided.
  const SRE_KEYWORDS = [
    "sre",
    "site reliability",
    "reliability",
    "platform",
    "devops",
    "infrastructure",
    "observability",
    "cloud",
    "kubernetes",
    "k8s",
  ];
  const AI_KEYWORDS = [
    "ai",
    "agent",
    "llm",
    "ml",
    "machine learning",
    "developer productivity",
    "dev productivity",
    "workflow",
    "automation",
    "codex",
    "cursor",
    "claude",
    "prompt",
  ];

  function normalizeWhitespace(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.replace(/\s+/g, " ").trim();
  }

  function truncateText(value, maxLength) {
    const normalized = normalizeWhitespace(value);
    if (!normalized || normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function slugify(value, fallback = "item") {
    const normalized = normalizeWhitespace(String(value ?? ""));
    const ascii = normalized
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const slug = ascii
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");

    return slug || fallback;
  }

  function ensureCaptureDate(options = {}) {
    const raw = normalizeWhitespace(options.capturedAt);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    return new Date().toISOString().slice(0, 10);
  }

  function readText(job, key) {
    return normalizeWhitespace(job?.[key]);
  }

  function safeText(value, fallback = "Unknown") {
    const normalized = normalizeWhitespace(value);
    return normalized || fallback;
  }

  function getSourceUrl(job) {
    const directUrl = readText(job, "link");
    return directUrl || LINKEDIN_FALLBACK_URL;
  }

  function hasDirectJobUrl(job) {
    return Boolean(readText(job, "link"));
  }

  function buildSearchText(job) {
    return [
      readText(job, "title"),
      readText(job, "company"),
      readText(job, "location"),
      readText(job, "workplaceType"),
      readText(job, "description"),
      readText(job, "experienceLevel"),
      Array.isArray(job?.industries) ? job.industries.join(" ") : "",
    ].join(" ").toLowerCase();
  }

  function collectMatchedTags(text, keywords, tag) {
    return keywords.reduce((matches, keyword) => {
      if (text.includes(keyword)) {
        matches.push(tag === keyword ? tag : keyword);
      }
      return matches;
    }, []);
  }

  function inferRoleTrackHint(job) {
    const text = buildSearchText(job);
    const sreHit = SRE_KEYWORDS.some((keyword) => text.includes(keyword));
    const aiHit = AI_KEYWORDS.some((keyword) => text.includes(keyword));

    if (sreHit && aiHit) {
      return "dual_track";
    }
    if (sreHit) {
      return "sre_platform";
    }
    if (aiHit) {
      return "ai_native_builder";
    }
    return "reject_candidate";
  }

  function inferWorkModel(job) {
    const text = [
      readText(job, "workplaceType"),
      readText(job, "location"),
      readText(job, "description"),
    ].join(" ").toLowerCase();

    if (!text) {
      return "Unknown";
    }

    if (/(hybrid|hibrit)/.test(text)) {
      return "hybrid";
    }
    if (/(on-site|onsite|on site|office|ofis|yerinde)/.test(text)) {
      return "onsite";
    }
    if (/(remote|uzaktan|work from home|home office)/.test(text)) {
      return "remote";
    }

    return "Unknown";
  }

  function inferRoleFamilyTags(job, roleTrackHint) {
    const text = buildSearchText(job);
    const tags = new Set();

    collectMatchedTags(text, SRE_KEYWORDS, "sre").forEach((keyword) => {
      if (["sre", "site reliability"].includes(keyword)) {
        tags.add("sre");
      }
      if (["platform", "infrastructure", "cloud", "kubernetes", "k8s"].includes(keyword)) {
        tags.add("platform");
      }
      if (["reliability", "observability", "devops"].includes(keyword)) {
        tags.add(keyword === "reliability" ? "reliability" : keyword);
      }
    });

    collectMatchedTags(text, AI_KEYWORDS, "ai").forEach((keyword) => {
      if (["ai", "llm", "ml", "machine learning"].includes(keyword)) {
        tags.add("ai_infra");
      }
      if (["agent", "workflow", "automation"].includes(keyword)) {
        tags.add("agentic_workflow");
      }
      if (["developer productivity", "dev productivity", "codex", "cursor", "claude", "prompt"].includes(keyword)) {
        tags.add("developer_productivity");
      }
    });

    if (roleTrackHint === "sre_platform" && tags.size === 0) {
      tags.add("platform");
    }
    if (roleTrackHint === "ai_native_builder" && tags.size === 0) {
      tags.add("developer_productivity");
    }
    if (roleTrackHint === "dual_track") {
      tags.add("platform");
      tags.add("developer_productivity");
    }

    return Array.from(tags);
  }

  function inferGeoFitSignal(job) {
    const text = [readText(job, "location"), readText(job, "description")].join(" ").toLowerCase();
    if (!text) {
      return "Unknown";
    }
    if (/(europe|eu|emea|germany|berlin|amsterdam|london|uk|istanbul|turkey)/.test(text)) {
      return "europe_friendly";
    }
    if (/(united states|usa|us only|north america|pst|est)/.test(text)) {
      return "us_heavy";
    }
    if (/remote/.test(text)) {
      return "global_mixed";
    }
    return "Unknown";
  }

  function inferSenioritySignal(job) {
    const text = [readText(job, "title"), readText(job, "experienceLevel")].join(" ").toLowerCase();
    if (/(staff|principal|lead|director|head)/.test(text)) {
      return "staff_plus";
    }
    if (/(senior|mid-senior|sr\.?)/.test(text)) {
      return "senior";
    }
    if (/(junior|entry|associate|intern)/.test(text)) {
      return "junior";
    }
    return "Unknown";
  }

  function inferEmploymentType(job) {
    const text = [readText(job, "description"), readText(job, "title")].join(" ").toLowerCase();
    if (/(contract|freelance|consultant|consulting)/.test(text)) {
      return "contract";
    }
    if (/(full time|full-time|permanent)/.test(text)) {
      return "full_time";
    }
    return "Unknown";
  }

  function inferAiWorkflowSignal(job) {
    const text = buildSearchText(job);
    if (/(cursor|claude|codex|llm|agent|ai-assisted|ai assisted|developer productivity)/.test(text)) {
      return "explicit";
    }
    if (/(ai|automation|workflow|prompt)/.test(text)) {
      return "implicit";
    }
    return "absent";
  }

  function inferLocationWorkModelGate(workModel) {
    if (workModel === "remote" || workModel === "hybrid") {
      return "pass";
    }
    if (workModel === "onsite") {
      return "risk";
    }
    return "risk";
  }

  function flattenCompanyOriginSignals(signals) {
    if (!signals || typeof signals !== "object") {
      return [];
    }

    const parts = [];
    Object.entries(signals).forEach(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        parts.push(`${key}=${values.join(", ")}`);
      }
    });
    return parts;
  }

  function normalizeProfileArray(value, maxItems = 20) {
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

  function normalizeWorkflowProfile(profile) {
    const source = profile && typeof profile === "object" ? profile : {};

    return {
      profileLabel: normalizeWhitespace(source.profileLabel) || "Job Search Profile",
      keywords: normalizeProfileArray(source.keywords),
      requiredKeywords: normalizeProfileArray(source.requiredKeywords),
      avoidKeywords: normalizeProfileArray(source.avoidKeywords),
      locationPreferences: normalizeProfileArray(source.locationPreferences, 10),
      remoteOnly: source.remoteOnly === true,
      companyOrigin: normalizeWhitespace(source.companyOrigin) || "any",
    };
  }

  function evaluateJobAgainstProfile(job, profile) {
    const normalizedProfile = normalizeWorkflowProfile(profile);
    const text = buildSearchText(job);
    const matchedKeywords = normalizedProfile.keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
    const missingRequiredKeywords = normalizedProfile.requiredKeywords.filter((keyword) => !text.includes(keyword.toLowerCase()));
    const blockedKeywords = normalizedProfile.avoidKeywords.filter((keyword) => text.includes(keyword.toLowerCase()));
    const locationMatches = normalizedProfile.locationPreferences.filter((item) => text.includes(item.toLowerCase()));
    const reasons = [];
    const risks = [];
    let fitLabel = "neutral";

    if (matchedKeywords.length > 0) {
      reasons.push(`matched keywords: ${matchedKeywords.join(", ")}`);
    }
    if (locationMatches.length > 0) {
      reasons.push(`matched locations: ${locationMatches.join(", ")}`);
    }
    if (normalizedProfile.remoteOnly && /remote|uzaktan/.test(text)) {
      reasons.push("remote-compatible signal present");
    }
    if (missingRequiredKeywords.length > 0) {
      risks.push(`missing required keywords: ${missingRequiredKeywords.join(", ")}`);
    }
    if (blockedKeywords.length > 0) {
      risks.push(`blocked keywords: ${blockedKeywords.join(", ")}`);
    }
    if (normalizedProfile.remoteOnly && /on-site|onsite|on site|office|ofis|yerinde/.test(text)) {
      risks.push("remote-only profile conflicts with onsite signal");
    }
    if (normalizedProfile.companyOrigin === "exclude-outsourcing" && readText(job, "companyOrigin") === "outsourcing") {
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
      profileLabel: normalizedProfile.profileLabel,
    };
  }

  function buildMainRisk(job, context) {
    const risks = [];

    if (!hasDirectJobUrl(job)) {
      risks.push("direct job URL missing");
    }
    if (context.workModel === "Unknown") {
      risks.push("work model unclear");
    }
    if (context.roleTrackHint === "reject_candidate") {
      risks.push("role track ambiguous");
    }
    if (context.profileHint && context.profileHint.risks.length > 0) {
      risks.push(context.profileHint.risks[0]);
    }

    return risks[0] || "manual triage required";
  }

  function buildNotes(job, context) {
    const parts = [];
    const companyOrigin = readText(job, "companyOrigin");
    const signalParts = flattenCompanyOriginSignals(job?.companyOriginSignals);

    if (companyOrigin) {
      parts.push(`companyOrigin=${companyOrigin}`);
    }
    if (signalParts.length > 0) {
      parts.push(`companyOriginSignals=${signalParts.join("; ")}`);
    }
    if (!hasDirectJobUrl(job)) {
      parts.push("direct job URL missing; fallback LinkedIn jobs homepage used");
    }
    if (context.aiAssistedWorkflowSignal !== "absent") {
      parts.push(`aiWorkflowSignal=${context.aiAssistedWorkflowSignal}`);
    }
    if (context.profileHint) {
      parts.push(`workflowProfile=${context.profileHint.profileLabel}`);
      parts.push(`profileFit=${context.profileHint.fitLabel}`);
    }

    return truncateText(parts.join(" | "), NOTES_LIMIT) || "manual LinkedIn extension export";
  }

  function buildExtractedFacts(job, context) {
    const facts = [];
    const description = truncateText(readText(job, "description"), DESCRIPTION_SNIPPET_LIMIT);
    const companyOrigin = readText(job, "companyOrigin");
    const signalParts = flattenCompanyOriginSignals(job?.companyOriginSignals);

    if (readText(job, "postedAt")) {
      facts.push(`postedAt raw: ${readText(job, "postedAt")}`);
    }
    if (description) {
      facts.push(`description snippet: ${description}`);
    }
    if (readText(job, "experienceLevel")) {
      facts.push(`experience level: ${readText(job, "experienceLevel")}`);
    }
    if (Array.isArray(job?.industries) && job.industries.length > 0) {
      facts.push(`industries: ${job.industries.map((item) => normalizeWhitespace(item)).filter(Boolean).join(", ")}`);
    }
    if (readText(job, "salaryText")) {
      facts.push(`salary text: ${readText(job, "salaryText")}`);
    }
    if (companyOrigin) {
      facts.push(`company origin: ${companyOrigin}`);
    }
    if (signalParts.length > 0) {
      facts.push(`company origin signals: ${signalParts.join("; ")}`);
    }
    if (!hasDirectJobUrl(job)) {
      facts.push("direct job URL missing; fallback LinkedIn jobs homepage used");
    }
    facts.push(`capture method: ${context.captureMethod}`);
    facts.push(`source policy state: ${context.sourcePolicyState}`);
    if (context.profileHint) {
      facts.push(`workflow profile fit: ${context.profileHint.fitLabel}`);
      context.profileHint.reasons.forEach((reason) => {
        facts.push(`workflow profile reason: ${reason}`);
      });
      context.profileHint.risks.forEach((risk) => {
        facts.push(`workflow profile risk: ${risk}`);
      });
    }

    return facts;
  }

  function buildWhyCaptured(job, context) {
    const why = [
      "Captured from the filtered LinkedIn jobs list via manual browser extension export.",
      `Role track hint: ${context.roleTrackHint}.`,
      `Work model signal: ${context.workModel}.`,
    ];

    if (readText(job, "companyOrigin")) {
      why.push(`Company origin classification seen during capture: ${readText(job, "companyOrigin")}.`);
    }
    if (context.profileHint) {
      why.push(`Job Search profile hint: ${context.profileHint.fitLabel} (${context.profileHint.profileLabel}).`);
    }

    return why;
  }

  function roleTrackLabel(roleTrackHint) {
    if (roleTrackHint === "sre_platform") {
      return "SRE / Platform / Reliability";
    }
    if (roleTrackHint === "ai_native_builder") {
      return "AI-native / AI-assisted developer workflow";
    }
    if (roleTrackHint === "dual_track") {
      return "Dual track: SRE / Platform + AI-native builder";
    }
    return "Manual triage required";
  }

  function buildExportContext(job, options = {}) {
    const capturedAt = ensureCaptureDate(options);
    const roleTrackHint = inferRoleTrackHint(job);
    const workModel = inferWorkModel(job);
    const sourceUrl = getSourceUrl(job);
    const roleTitle = safeText(readText(job, "title"), "Unknown Role");
    const company = safeText(readText(job, "company"), "Unknown Company");
    const locationRaw = safeText(readText(job, "location"));
    const sourceId = safeText(options.sourceId, DEFAULT_SOURCE_ID);
    const sourceFamily = safeText(options.sourceFamily, DEFAULT_SOURCE_FAMILY);
    const captureMethod = safeText(options.captureMethod, DEFAULT_CAPTURE_METHOD);
    const sourcePolicyState = safeText(options.sourcePolicyState, DEFAULT_SOURCE_POLICY_STATE);
    const decisionHandoffState = safeText(options.decisionHandoffState, DEFAULT_DECISION_HANDOFF_STATE);
    const normalizedStatus = safeText(options.normalizedStatus, DEFAULT_NORMALIZED_STATUS);
    const roleFamilyTags = inferRoleFamilyTags(job, roleTrackHint);
    const aiAssistedWorkflowSignal = inferAiWorkflowSignal(job);
    const profileHint = options.workflowProfile
      ? evaluateJobAgainstProfile(job, options.workflowProfile)
      : null;
    const context = {
      capturedAt,
      sourceId,
      sourceFamily,
      sourceClass: safeText(options.sourceClass, sourceFamily),
      captureMethod,
      sourcePolicyState,
      decisionHandoffState,
      normalizedStatus,
      sourceUrl,
      canonicalJobUrl: sourceUrl,
      company,
      roleTitle,
      locationRaw,
      workModel,
      roleTrackHint,
      roleFamilyTags,
      geoFitSignal: inferGeoFitSignal(job),
      senioritySignal: inferSenioritySignal(job),
      employmentType: inferEmploymentType(job),
      aiAssistedWorkflowSignal,
      aiAssistedGapTolerance: aiAssistedWorkflowSignal === "explicit" ? "medium" : aiAssistedWorkflowSignal === "implicit" ? "low" : "not_applicable",
      locationWorkModelGate: inferLocationWorkModelGate(workModel),
      profileHint,
    };

    context.mainRisk = buildMainRisk(job, context);
    context.mainFitReason = `Filtered LinkedIn capture; track hint=${context.roleTrackHint}; work model=${context.workModel}${profileHint ? `; profile fit=${profileHint.fitLabel}` : ""}`;
    context.notes = buildNotes(job, context);
    context.extractedFacts = buildExtractedFacts(job, context);
    context.whyCaptured = buildWhyCaptured(job, context);
    context.rawRecordPath = `inbox/jobs/${slugifyJobRecord(job, { capturedAt })}.md`;
    context.recordId = slugifyJobRecord(job, { capturedAt });
    context.dedupeKey = hasDirectJobUrl(job)
      ? `${context.sourceId}|${slugify(context.canonicalJobUrl, "linkedin-job")}`
      : `${context.sourceId}|${slugify(context.company, "company")}|${slugify(context.roleTitle, "role")}|${slugify(context.locationRaw, "location")}`;

    return context;
  }

  function slugifyJobRecord(job, options = {}) {
    const capturedAt = ensureCaptureDate(options);
    const company = slugify(readText(job, "company"), "unknown-company");
    const role = slugify(readText(job, "title"), "unknown-role");
    return `${capturedAt}-${company}-${role}`;
  }

  function formatMarkdownJob(job, options = {}) {
    const context = buildExportContext(job, options);
    const lines = [
      `# ${context.company} - ${context.roleTitle}`,
      "",
      `source_id: ${context.sourceId}`,
      `source_url: <${context.sourceUrl}>`,
      `catalog_root_url: <${context.canonicalJobUrl}>`,
      `captured_at: ${context.capturedAt}`,
      `company: ${context.company}`,
      `role_title: ${context.roleTitle}`,
      `location: ${context.locationRaw}`,
      `work_model: ${context.workModel}`,
      `source_class: ${context.sourceClass}`,
      `capture_method: ${context.captureMethod}`,
      `source_policy_state: ${context.sourcePolicyState}`,
      `decision_handoff_state: ${context.decisionHandoffState}`,
      `normalized_status: ${context.normalizedStatus}`,
      `role_track_hint: ${context.roleTrackHint}`,
      `location_work_model_gate: ${context.locationWorkModelGate}`,
      "",
      "## Why Captured",
      "",
      ...context.whyCaptured.map((item) => `- ${item}`),
      "",
      "## Extracted Facts",
      "",
      ...context.extractedFacts.map((item) => `- ${item}`),
      "",
      "## Fit Hypothesis",
      "",
      `- Primary match: ${roleTrackLabel(context.roleTrackHint)}`,
      "- Initial fit score: Unknown",
      `- Initial decision: ${context.decisionHandoffState}`,
      `- Main risk: ${context.mainRisk}`,
      "",
      "## Application Status",
      "",
      "- Status: Unknown",
      "- Applied at: Unknown",
      "- Materials used: Unknown",
      "- Tracking note: Manual download/copy export only; move into Job Search Workflow repo manually if needed.",
    ];

    return lines.join("\n");
  }

  function toWorkflowMarkdown(jobs, options = {}) {
    const records = Array.isArray(jobs) ? jobs : [];
    return records.map((job) => formatMarkdownJob(job, options)).join("\n\n---\n\n");
  }

  function toWorkflowJsonl(jobs, options = {}) {
    const records = Array.isArray(jobs) ? jobs : [];
    return records.map((job) => {
      const context = buildExportContext(job, options);
      const normalizedRecord = {
        record_id: context.recordId,
        captured_at: context.capturedAt,
        source_id: context.sourceId,
        source_family: context.sourceFamily,
        source_url: context.sourceUrl,
        canonical_job_url: context.canonicalJobUrl,
        company: context.company,
        role_title: context.roleTitle,
        role_track_hint: context.roleTrackHint,
        role_family_tags: context.roleFamilyTags,
        location_raw: context.locationRaw,
        work_model: context.workModel,
        watch_tier: DEFAULT_WATCH_TIER,
        geo_fit_signal: context.geoFitSignal,
        seniority_signal: context.senioritySignal,
        employment_type: context.employmentType,
        location_work_model_gate: context.locationWorkModelGate,
        ai_assisted_workflow_signal: context.aiAssistedWorkflowSignal,
        ai_assisted_gap_tolerance: context.aiAssistedGapTolerance,
        compensation_signal: safeText(readText(job, "salaryText")),
        capture_method: context.captureMethod,
        raw_record_path: context.rawRecordPath,
        source_policy_state: context.sourcePolicyState,
        dedupe_key: context.dedupeKey,
        normalized_status: context.normalizedStatus,
        decision_handoff_state: context.decisionHandoffState,
        main_fit_reason: context.mainFitReason,
        main_risk: context.mainRisk,
        notes: context.notes,
      };

      return JSON.stringify(normalizedRecord);
    }).join("\n");
  }

  const api = {
    toWorkflowMarkdown,
    toWorkflowJsonl,
    slugifyJobRecord,
    inferRoleTrackHint,
    inferWorkModel,
  };

  globalTarget.JobSearchExporter = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
