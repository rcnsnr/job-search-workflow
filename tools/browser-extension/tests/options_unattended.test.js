// tests/options_unattended.test.js
// Options page Unattended Scan tab tests

/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

function loadHtml() {
  const htmlPath = path.join(__dirname, "../options.html");
  return fs.readFileSync(htmlPath, "utf8");
}

describe("Options Unattended Scan tab", () => {
  let mockStorage;
  let sendMessageMock;
  let buildScanPlanMock;

  beforeEach(() => {
    document.body.innerHTML = loadHtml();

    mockStorage = {};
    sendMessageMock = jest.fn(() => Promise.resolve({ success: true }));
    buildScanPlanMock = jest.fn(() => ({
      queries: [{ id: "q1", url: "https://www.linkedin.com/jobs/search/?keywords=sre" }],
      pacing: { delayRangeMs: [6000, 10000] },
    }));

    window.JobSearchProfileUtils = {
      PROFILE_MODES: { OFF: "off", DEFAULT_FILTERS: "default_filters" },
      normalizeWorkflowProfile: (profile) => ({
        profileLabel: "",
        roleTracks: [],
        keywords: [],
        requiredKeywords: [],
        avoidKeywords: [],
        locationPreferences: [],
        remoteOnly: false,
        companyOrigin: "",
        minSalary: null,
        ...(profile || {}),
      }),
      createWorkflowProfileTemplate: () => "{}",
      parseWorkflowProfileInput: (text) => ({ ok: true, rawText: text || "", profile: {} }),
    };
    window.buildScanPlan = buildScanPlanMock;

    global.chrome = {
      runtime: {
        getManifest: () => ({ version: "2.0.0" }),
        sendMessage: jest.fn((message) => {
          if (message?.action === "getTelemetry") {
            return Promise.resolve({
              success: true,
              telemetry: { processedToday: 0, premiumCallsToday: 0 },
            });
          }
          return sendMessageMock(message);
        }),
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach((key) => {
                if (mockStorage[key] !== undefined) result[key] = mockStorage[key];
              });
            }
            if (callback) callback(result);
            return Promise.resolve(result);
          }),
          set: jest.fn((items, callback) => {
            Object.assign(mockStorage, items);
            if (callback) callback();
            return Promise.resolve();
          }),
          getBytesInUse: jest.fn((_, callback) => {
            if (callback) callback(0);
          }),
        },
      },
    };

    global.navigator = { userAgent: "Chrome/100" };

    jest.isolateModules(() => {
      require("../options.js");
    });

    document.dispatchEvent(new Event("DOMContentLoaded"));
  });

  afterEach(() => {
    jest.resetModules();
    delete window.JobSearchProfileUtils;
    delete window.buildScanPlan;
    delete global.chrome;
  });

  it("has an Unattended tab button and section", () => {
    const tabButton = document.querySelector('.tab-button[data-tab="unattended"]');
    const section = document.getElementById("unattended");
    expect(tabButton).not.toBeNull();
    expect(section).not.toBeNull();
  });

  it("switches to Unattended section when tab is clicked", () => {
    const tabButton = document.querySelector('.tab-button[data-tab="unattended"]');
    const section = document.getElementById("unattended");
    const generalSection = document.getElementById("general");

    expect(section.classList.contains("active")).toBe(false);
    tabButton.click();

    expect(tabButton.classList.contains("active")).toBe(true);
    expect(section.classList.contains("active")).toBe(true);
    expect(generalSection.classList.contains("active")).toBe(false);
  });

  it("saves unattended scan settings to storage", async () => {
    document.getElementById("capture-server-url").value = "http://localhost:8766";
    document.getElementById("unattended-keywords").value = "sre\nplatform engineer";
    document.getElementById("unattended-locations").value = "Europe";
    document.getElementById("unattended-pacing-profile").value = "conservative";
    document.getElementById("unattended-period-minutes").value = "60";

    document.getElementById("save-unattended-scan").click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockStorage.optionsSettings).toMatchObject({
      captureServerUrl: "http://localhost:8766",
      unattendedKeywords: "sre\nplatform engineer",
      unattendedLocations: "Europe",
      unattendedPacingProfile: "conservative",
      unattendedPeriodMinutes: 60,
    });
  });

  it("starts unattended scan with a generated plan", async () => {
    document.getElementById("unattended-keywords").value = "sre";
    document.getElementById("unattended-locations").value = "Europe";
    document.getElementById("unattended-pacing-profile").value = "conservative";
    document.getElementById("unattended-period-minutes").value = "60";

    document.getElementById("start-unattended-scan").click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(buildScanPlanMock).toHaveBeenCalledWith(expect.objectContaining({
      keywords: ["sre"],
      locations: ["Europe"],
      profile: "conservative",
    }));
    expect(sendMessageMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "startAutoScan",
      periodInMinutes: 60,
    }));
  });

  it("stops unattended scan", async () => {
    document.getElementById("stop-unattended-scan").click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sendMessageMock).toHaveBeenCalledWith({ action: "stopAutoScan" });
  });
});
