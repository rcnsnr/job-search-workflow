const {
  toCareerOpsMarkdown,
  toCareerOpsJsonl,
  slugifyJobRecord,
  inferRoleTrackHint,
  inferWorkModel,
} = require("../utils/careerops_exporter");

describe("CareerOps exporter", () => {
  const baseOptions = {
    capturedAt: "2026-06-18",
  };
  const profileHintOptions = {
    ...baseOptions,
    careerOpsProfile: {
      profileLabel: "CareerOps Default Profile",
      keywords: ["platform", "agent"],
      requiredKeywords: ["platform"],
      locationPreferences: ["Europe"],
      remoteOnly: true,
      companyOrigin: "exclude-outsourcing",
    },
  };

  const sampleJob = {
    title: "Senior Platform Engineer, AI Agents",
    company: "Acme Labs",
    location: "Remote - Europe",
    workplaceType: "Remote",
    postedAt: "2026-06-17T10:00:00.000Z",
    description: "Build platform tooling, SRE guardrails, agent workflows, and developer productivity systems.",
    experienceLevel: "Mid-Senior level",
    industries: ["Software Development", "AI"],
    salaryText: "€90K - €110K",
    link: "https://www.linkedin.com/jobs/view/123456789/",
    companyOrigin: "direct",
    companyOriginSignals: {
      outsourcing: [],
      direct: ["company:acme"],
    },
    cookie: "do-not-export",
    token: "do-not-export",
    session: "do-not-export",
    browserProfile: "do-not-export",
    premiumPayload: "do-not-export",
  };

  function splitMarkdownRecords(markdown) {
    return markdown.split(/\n\n---\n\n/);
  }

  test("slugifyJobRecord generates safe date/company/role slug", () => {
    expect(slugifyJobRecord(sampleJob, baseOptions)).toBe(
      "2026-06-18-acme-labs-senior-platform-engineer-ai-agents"
    );
  });

  test("inferRoleTrackHint returns sre_platform", () => {
    expect(inferRoleTrackHint({ title: "Senior Site Reliability Engineer" })).toBe("sre_platform");
  });

  test("inferRoleTrackHint returns ai_native_builder", () => {
    expect(inferRoleTrackHint({ title: "AI Workflow Builder", description: "Agent tooling" })).toBe("ai_native_builder");
  });

  test("inferRoleTrackHint returns dual_track", () => {
    expect(inferRoleTrackHint(sampleJob)).toBe("dual_track");
  });

  test("inferRoleTrackHint returns reject_candidate", () => {
    expect(inferRoleTrackHint({ title: "Account Executive", description: "Sales pipeline" })).toBe("reject_candidate");
  });

  test("inferWorkModel normalizes remote", () => {
    expect(inferWorkModel({ workplaceType: "Remote" })).toBe("remote");
  });

  test("inferWorkModel normalizes hybrid", () => {
    expect(inferWorkModel({ workplaceType: "Hybrid" })).toBe("hybrid");
  });

  test("inferWorkModel normalizes onsite", () => {
    expect(inferWorkModel({ location: "On-site / Berlin" })).toBe("onsite");
  });

  test("inferWorkModel falls back to Unknown", () => {
    expect(inferWorkModel({ location: "Flexible" })).toBe("Unknown");
  });

  test("toCareerOpsMarkdown creates parser-shaped blocks", () => {
    const markdown = toCareerOpsMarkdown([sampleJob], baseOptions);
    const [record] = splitMarkdownRecords(markdown);

    expect(record.startsWith("# Acme Labs - Senior Platform Engineer, AI Agents")).toBe(true);
    expect(record).toContain("source_id: job-search-workflow-capture");
    expect(record).toContain("source_url: <https://www.linkedin.com/jobs/view/123456789/>");
    expect(record).toContain("catalog_root_url: <https://www.linkedin.com/jobs/view/123456789/>");
    expect(record).toContain("captured_at: 2026-06-18");
    expect(record).toContain("company: Acme Labs");
    expect(record).toContain("role_title: Senior Platform Engineer, AI Agents");
    expect(record).toContain("location: Remote - Europe");
    expect(record).toContain("work_model: remote");
    expect(record).toContain("source_class: job_search_workflow_capture");
    expect(record).toContain("capture_method: manual_browser_extension_export");
    expect(record).toContain("## Why Captured");
    expect(record).toContain("## Extracted Facts");
    expect(record).toContain("## Fit Hypothesis");
    expect(record).toContain("## Application Status");
    expect(record).toContain("- Initial decision: pending_triage");
    expect(record).toContain("description snippet:");
    expect(record).not.toContain("do-not-export");
  });

  test("toCareerOpsMarkdown includes profile hints when provided", () => {
    const markdown = toCareerOpsMarkdown([sampleJob], profileHintOptions);
    expect(markdown).toContain("CareerOps profile hint: strong_match");
    expect(markdown).toContain("careerops profile fit: strong_match");
  });

  test("toCareerOpsMarkdown joins multiple records with split-safe delimiter", () => {
    const markdown = toCareerOpsMarkdown([
      sampleJob,
      {
        ...sampleJob,
        title: "Staff SRE",
      },
    ], baseOptions);

    const records = splitMarkdownRecords(markdown);
    expect(records).toHaveLength(2);
    expect(records[0].startsWith("# ")).toBe(true);
    expect(records[1].startsWith("# ")).toBe(true);
  });

  test("toCareerOpsJsonl emits valid JSON per line with mapped fields", () => {
    const jsonl = toCareerOpsJsonl([sampleJob], profileHintOptions);
    const lines = jsonl.split("\n");
    expect(lines).toHaveLength(1);

    const record = JSON.parse(lines[0]);
    expect(record.record_id).toBe("2026-06-18-acme-labs-senior-platform-engineer-ai-agents");
    expect(record.source_family).toBe("job_search_workflow_capture");
    expect(record.source_url).toBe("https://www.linkedin.com/jobs/view/123456789/");
    expect(record.canonical_job_url).toBe("https://www.linkedin.com/jobs/view/123456789/");
    expect(record.company).toBe("Acme Labs");
    expect(record.role_title).toBe("Senior Platform Engineer, AI Agents");
    expect(record.role_track_hint).toBe("dual_track");
    expect(record.location_raw).toBe("Remote - Europe");
    expect(record.work_model).toBe("remote");
    expect(record.capture_method).toBe("manual_browser_extension_export");
    expect(record.raw_record_path).toBe(
      "inbox/jobs/2026-06-18-acme-labs-senior-platform-engineer-ai-agents.md"
    );
    expect(record.source_policy_state).toBe("discovery_only");
    expect(record.decision_handoff_state).toBe("pending_triage");
    expect(record.normalized_status).toBe("new");
    expect(record.main_fit_reason).toContain("profile fit=strong_match");
    expect(record.notes).toContain("careerOpsProfile=CareerOps Default Profile");
    expect(record.notes).not.toContain("do-not-export");
  });

  test("missing fields use bounded fallbacks and link fallback risk", () => {
    const markdown = toCareerOpsMarkdown([
      {
        title: "",
        company: "",
        location: "",
        link: "",
      },
    ], baseOptions);
    const jsonl = toCareerOpsJsonl([
      {
        title: "",
        company: "",
        location: "",
        link: "",
      },
    ], baseOptions);

    expect(markdown).toContain("# Unknown Company - Unknown Role");
    expect(markdown).toContain("source_url: <https://www.linkedin.com/jobs/>");
    expect(markdown).toContain("Main risk: direct job URL missing");

    const record = JSON.parse(jsonl);
    expect(record.company).toBe("Unknown Company");
    expect(record.role_title).toBe("Unknown Role");
    expect(record.location_raw).toBe("Unknown");
    expect(record.source_url).toBe("https://www.linkedin.com/jobs/");
    expect(record.main_risk).toBe("direct job URL missing");
  });

  test("secret-like fields are never serialized into markdown or jsonl", () => {
    const markdown = toCareerOpsMarkdown([sampleJob], baseOptions);
    const jsonl = toCareerOpsJsonl([sampleJob], baseOptions);

    ["cookie", "token", "session", "browserProfile", "premiumPayload", "do-not-export"].forEach((term) => {
      expect(markdown).not.toContain(term);
      expect(jsonl).not.toContain(term);
    });
  });
});
