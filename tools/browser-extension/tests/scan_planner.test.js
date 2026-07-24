// tests/scan_planner.test.js
// Query matrix generator tests for unattended LinkedIn scan

const {
  buildLinkedInSearchUrl,
  buildScanPlan,
  PACING_PROFILES,
} = require("../utils/scan_planner");

describe("scan_planner", () => {
  describe("buildLinkedInSearchUrl", () => {
    it("encodes keyword and location", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "senior platform engineer",
        location: "Europe",
        sortBy: "",
      });
      expect(url).toBe(
        "https://www.linkedin.com/jobs/search/?keywords=senior+platform+engineer&location=Europe"
      );
    });

    it("defaults to sortBy=DD for newest first", () => {
      const url = buildLinkedInSearchUrl({ keyword: "ai engineer" });
      expect(url).toContain("sortBy=DD");
    });

    it("supports natural language style keyword queries", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "remote platform engineer jobs in Europe not outsourcing",
        sortBy: "",
      });
      expect(url).toContain(
        "keywords=remote+platform+engineer+jobs+in+Europe+not+outsourcing"
      );
    });

    it("adds remote filter when remoteOnly is true", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "sre",
        location: "",
        remoteOnly: true,
      });
      expect(url).toContain("f_WT=2");
    });

    it("adds date filter for past 24h", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "devops",
        dateFilter: "r86400",
      });
      expect(url).toContain("f_TPR=r86400");
    });

    it("adds date filter for past week", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "devops",
        dateFilter: "r604800",
      });
      expect(url).toContain("f_TPR=r604800");
    });

    it("keeps base url stable with minimal input", () => {
      const url = buildLinkedInSearchUrl({ keyword: "ai engineer" });
      expect(url.startsWith("https://www.linkedin.com/jobs/search/")).toBe(true);
      expect(url).not.toContain("undefined");
    });

    it("adds multi-select workplace type filter", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "sre",
        workTypes: ["2", "3"],
        sortBy: "",
      });
      expect(url).toContain("f_WT=2%2C3");
    });

    it("maps remoteOnly legacy flag to remote workplace type", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "sre",
        remoteOnly: true,
        sortBy: "",
      });
      expect(url).toContain("f_WT=2");
    });

    it("adds job type and experience level filters", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "platform engineer",
        jobTypes: ["F", "C"],
        experienceLevels: ["4", "5"],
        sortBy: "",
      });
      expect(url).toContain("f_JT=F%2CC");
      expect(url).toContain("f_E=4%2C5");
    });

    it("adds easy apply and actively hiring filters", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "devops",
        easyApply: true,
        activelyHiring: true,
        under10Applicants: true,
        verifiedJobs: true,
        sortBy: "",
      });
      expect(url).toContain("f_EA=true");
      expect(url).toContain("f_AL=true");
      expect(url).toContain("f_JIYN=true");
      expect(url).toContain("f_VJ=true");
    });

    it("adds company, city and salary filters", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "ai engineer",
        companyIds: ["123", "456"],
        cityIds: ["789"],
        minSalary: 100000,
        sortBy: "",
      });
      expect(url).toContain("f_C=123%2C456");
      expect(url).toContain("f_PP=789");
      expect(url).toContain("f_SB2=100000");
    });

    it("prefers geoId over location text", () => {
      const url = buildLinkedInSearchUrl({
        keyword: "sre",
        geoId: "101165590",
        sortBy: "",
      });
      expect(url).toContain("geoId=101165590");
      expect(url).not.toContain("location=");
    });
  });

  describe("PACING_PROFILES", () => {
    it("contains conservative, balanced, and aggressive profiles", () => {
      expect(PACING_PROFILES.conservative).toBeDefined();
      expect(PACING_PROFILES.balanced).toBeDefined();
      expect(PACING_PROFILES.aggressive).toBeDefined();
    });

    it("conservative has the slowest settings", () => {
      const c = PACING_PROFILES.conservative;
      expect(c.delayRangeMs[0]).toBeGreaterThanOrEqual(6000);
      expect(c.batchSize).toBe(3);
      expect(c.cooldownAfterBatchMs).toBe(20000);
      expect(c.querySpacingMs[1]).toBeLessThanOrEqual(60000);
    });
  });

  describe("buildScanPlan", () => {
    const baseSettings = {
      keywords: ["platform engineer", "sre"],
      locations: ["Europe", "Worldwide"],
      dateFilters: ["r86400"],
      remoteOnly: false,
      profile: "conservative",
      captureServerUrl: "http://localhost:8766",
    };

    it("generates a plan with one entry per keyword×location combination", () => {
      const plan = buildScanPlan(baseSettings);
      expect(plan.queries).toHaveLength(4);
      expect(plan.queries.every((q) => q.url && q.id)).toBe(true);
    });

    it("deduplicates identical keyword+location+date+remote combos", () => {
      const plan = buildScanPlan({
        ...baseSettings,
        keywords: ["sre", "sre"],
        locations: ["Europe", "Europe"],
      });
      expect(plan.queries).toHaveLength(1);
    });

    it("applies conservative pacing by default", () => {
      const plan = buildScanPlan({
        ...baseSettings,
        keywords: ["devops"],
        locations: ["Remote"],
      });
      expect(plan.pacing.delayRangeMs).toEqual([6000, 10000]);
      expect(plan.pacing.batchSize).toBe(3);
    });

    it("returns unknown profile fallback gracefully", () => {
      const plan = buildScanPlan({
        ...baseSettings,
        keywords: ["devops"],
        locations: ["Remote"],
        profile: "nonexistent",
      });
      expect(plan.pacing).toBeDefined();
      expect(plan.queries).toHaveLength(1);
    });

    it("associates capture server URL with each query", () => {
      const plan = buildScanPlan({
        ...baseSettings,
        keywords: ["devops"],
        locations: ["Remote"],
      });
      expect(plan.captureServerUrl).toBe("http://localhost:8766");
      expect(plan.queries[0].captureServerUrl).toBe("http://localhost:8766");
    });

    it("labels each query with clean metadata", () => {
      const plan = buildScanPlan({
        ...baseSettings,
        keywords: ["ai engineer"],
        locations: ["Europe"],
        remoteOnly: true,
      });
      const q = plan.queries[0];
      expect(q.keyword).toBe("ai engineer");
      expect(q.location).toBe("Europe");
      expect(q.remoteOnly).toBe(true);
      expect(q.dateFilter).toBe("r86400");
      expect(q.sortBy).toBe("DD");
      expect(q.searchMode).toBe("keyword");
    });

    it("supports new LinkedIn search filters in the scan plan", () => {
      const plan = buildScanPlan({
        keywords: ["platform engineer"],
        locations: [""],
        workTypes: ["2", "3"],
        jobTypes: ["F"],
        experienceLevels: ["4"],
        easyApply: true,
        activelyHiring: true,
        under10Applicants: true,
        verifiedJobs: true,
        minSalary: 120000,
        sortBy: "DD",
        searchMode: "natural",
      });
      const q = plan.queries[0];
      expect(q.url).toContain("f_WT=2%2C3");
      expect(q.url).toContain("f_JT=F");
      expect(q.url).toContain("f_E=4");
      expect(q.url).toContain("f_EA=true");
      expect(q.url).toContain("f_AL=true");
      expect(q.url).toContain("f_JIYN=true");
      expect(q.url).toContain("f_VJ=true");
      expect(q.url).toContain("f_SB2=120000");
      expect(q.url).toContain("sortBy=DD");
      expect(q.searchMode).toBe("natural");
    });

    it("orders queries deterministically", () => {
      const plan = buildScanPlan(baseSettings);
      const ids = plan.queries.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toEqual([...ids].sort());
    });

    it("supports empty location by using an empty string", () => {
      const plan = buildScanPlan({
        ...baseSettings,
        keywords: ["devops"],
        locations: [""],
      });
      expect(plan.queries).toHaveLength(1);
      expect(plan.queries[0].url).not.toContain("location=undefined");
    });
  });
});
