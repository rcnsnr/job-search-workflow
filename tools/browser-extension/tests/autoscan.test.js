// tests/autoscan.test.js
// Unattended scan loop tests for content/autoscan.js

/**
 * @jest-environment jsdom
 */

describe("autoscan content script", () => {
  let fetchMock;
  let mockStorage;
  let runtimeListeners;
  let scrollCalls;

  beforeEach(() => {
    document.body.innerHTML = "";
    window.__careerOpsAutoScanInitialized = false;
    delete window.WorkflowAutoScan;
    scrollCalls = [];
    window.scrollTo = jest.fn((x, y) => {
      scrollCalls.push({ x, y });
    });

    let mockHref = "https://www.linkedin.com/jobs/search/";
    try {
      Object.defineProperty(window.location, "href", {
        configurable: true,
        get: () => mockHref,
        set: (url) => {
          mockHref = url;
        },
      });
    } catch (error) {
      // Some jsdom versions keep location read-only; ignore
    }

    fetchMock = jest.fn();
    global.fetch = fetchMock;

    mockStorage = {};

    runtimeListeners = [];

    global.chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn((handler) => {
            runtimeListeners.push(handler);
          }),
        },
        sendMessage: jest.fn(() => Promise.resolve()),
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach((key) => {
                if (mockStorage[key] !== undefined) result[key] = mockStorage[key];
              });
            } else if (keys === null) {
              Object.assign(result, mockStorage);
            } else if (mockStorage[keys] !== undefined) {
              result[keys] = mockStorage[keys];
            }
            callback(result);
          }),
          set: jest.fn((items, callback) => {
            Object.assign(mockStorage, items);
            if (callback) callback();
          }),
        },
      },
    };

    window.WorkflowLinkedInScraper = {
      getJobCards: jest.fn(() => Array.from(document.querySelectorAll("[data-occludable-job-id]"))),
      extractJob: jest.fn((card) => ({
        title: card.dataset.title || "Software Engineer",
        company: card.dataset.company || "Example",
        location: card.dataset.location || "Remote",
        link: card.dataset.link || "https://www.linkedin.com/jobs/view/123/",
        description: "Test job",
        postedAt: "2026-07-21",
      })),
      collectJobs: jest.fn(() => {
        const cards = Array.from(document.querySelectorAll("[data-occludable-job-id]"));
        return cards.map((card) => window.WorkflowLinkedInScraper.extractJob(card));
      }),
      detectPageType: jest.fn(() => "search"),
    };

    jest.useRealTimers();
  });

  afterEach(() => {
    delete window.WorkflowAutoScan;
    delete window.__careerOpsAutoScanInitialized;
  });

  function requireAutoscan() {
    jest.isolateModules(() => {
      require("../content/autoscan.js");
    });
  }

  function dispatchRuntimeMessage(message) {
    const sendResponse = jest.fn();
    for (const listener of runtimeListeners) {
      listener(message, {}, sendResponse);
    }
    return sendResponse;
  }

  function fastOptions(overrides = {}) {
    return {
      captureServerUrl: "http://localhost:8766",
      batchSize: 1,
      delayRangeMs: [0, 0],
      cooldownAfterBatchMs: 0,
      scrollOptions: { steps: 1, stepDelayMs: 0 },
      scrollWaitMs: 0,
      ...overrides,
    };
  }

  it("registers a runtime message listener on load", () => {
    requireAutoscan();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(runtimeListeners.length).toBeGreaterThan(0);
  });

  it("exposes WorkflowAutoScan on window", () => {
    requireAutoscan();
    expect(window.WorkflowAutoScan).toBeDefined();
    expect(typeof window.WorkflowAutoScan.start).toBe("function");
    expect(typeof window.WorkflowAutoScan.stop).toBe("function");
  });

  it("collectCurrentPage sends a POST to the capture server", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    document.body.innerHTML = `
      <li data-occludable-job-id="1" data-title="Platform Engineer" data-company="Acme" data-location="Remote" data-link="https://www.linkedin.com/jobs/view/1/"></li>
    `;

    requireAutoscan();
    const result = await window.WorkflowAutoScan.collectCurrentPage(fastOptions());

    expect(result.collected).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8766/batch",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(callBody.jobs).toHaveLength(1);
    expect(callBody.jobs[0].role_title).toBe("Platform Engineer");
    expect(callBody.jobs[0].source_url).toBe("https://www.linkedin.com/jobs/view/1/");
    expect(callBody.jobs[0].source_id).toBe("linkedin-1");
  });

  it("collectCurrentPage returns empty when no job cards are found", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    requireAutoscan();
    const result = await window.WorkflowAutoScan.collectCurrentPage(fastOptions());
    expect(result.collected).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("collectCurrentPage performs multiple scroll cycles and stops when no new cards appear", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    let html = "";
    for (let i = 1; i <= 3; i++) {
      html += `<li data-occludable-job-id="${i}" data-title="Job ${i}" data-company="Co${i}" data-location="Remote" data-link="https://www.linkedin.com/jobs/view/${i}/"></li>`;
    }
    document.body.innerHTML = html;

    // Mark card 3 as not visible until the second scroll cycle by making the
    // scraper return an expanding list.
    let visibleCount = 2;
    window.WorkflowLinkedInScraper.collectJobs = jest.fn(() => {
      const cards = Array.from(document.querySelectorAll("[data-occludable-job-id]")).slice(0, visibleCount);
      visibleCount = Math.min(visibleCount + 1, 3);
      return cards.map((card) => window.WorkflowLinkedInScraper.extractJob(card));
    });

    requireAutoscan();
    const result = await window.WorkflowAutoScan.collectCurrentPage(
      fastOptions({ maxScrollCycles: 4 })
    );

    expect(result.collected).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("collectCurrentPage posts in batches and respects batchSize", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<li data-occludable-job-id="${i}" data-title="Job ${i}" data-company="Co${i}" data-location="Remote" data-link="https://www.linkedin.com/jobs/view/${i}/"></li>`;
    }
    document.body.innerHTML = html;

    requireAutoscan();
    const result = await window.WorkflowAutoScan.collectCurrentPage(
      fastOptions({ batchSize: 2 })
    );

    expect(result.collected).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 + 2 + 1
  });

  it("stops the scan when stop is called", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    document.body.innerHTML = `
      <li data-occludable-job-id="1" data-title="Job 1" data-company="Co1" data-location="Remote" data-link="https://www.linkedin.com/jobs/view/1/"></li>
    `;

    requireAutoscan();

    const startPromise = window.WorkflowAutoScan.start({
      queries: [{ captureServerUrl: "http://localhost:8766" }],
      pacing: {
        batchSize: 1,
        delayRangeMs: [0, 0],
        cooldownAfterBatchMs: 0,
        querySpacingMs: [0, 0],
        scrollOptions: { steps: 1, stepDelayMs: 0 },
        scrollWaitMs: 0,
      },
      postNavigateWaitMs: 0,
    });

    window.WorkflowAutoScan.stop();
    await startPromise;

    expect(window.WorkflowAutoScan.getState().isRunning).toBe(false);
  });

  it("humanLikeScroll calls window.scrollTo progressively", () => {
    document.body.innerHTML = `<div style="height:2000px"></div>`;
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 800,
    });

    requireAutoscan();
    window.WorkflowAutoScan.humanLikeScroll({ steps: 2, stepDelayMs: 0 });

    expect(scrollCalls.length).toBeGreaterThan(0);
  });

  it("reports server errors without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));

    document.body.innerHTML = `
      <li data-occludable-job-id="1" data-title="Job 1" data-company="Co1" data-location="Remote" data-link="https://www.linkedin.com/jobs/view/1/"></li>
    `;

    requireAutoscan();
    const result = await window.WorkflowAutoScan.collectCurrentPage(fastOptions());

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/connection refused/);
  });
});
