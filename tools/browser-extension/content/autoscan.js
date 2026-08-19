// content/autoscan.js
// Unattended scan loop for LinkedIn Jobs -> Workflow capture server
(function () {
  if (window.__jswAutoScanInitialized) {
    return;
  }

  const DEFAULT_CAPTURE_SERVER_URL = "http://localhost:8766";

  const state = {
    isRunning: false,
    shouldStop: false,
    currentQueryIndex: 0,
    plan: null,
    errors: [],
  };

  function randomBetween([min, max]) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getScraper() {
    return window.WorkflowLinkedInScraper || null;
  }

  function reportStatus(status) {
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      try {
        const result = chrome.runtime.sendMessage({ action: "autoScanStatus", status });
        if (result && typeof result.catch === "function") {
          result.catch(() => {
            // Background may be unavailable in test / transient state
          });
        }
      } catch (error) {
        // Ignore transient send failures
      }
    }
  }

  function buildSourceId(job) {
    const match = job.link?.match(/\/jobs\/view\/(\d+)/);
    if (match) {
      return `linkedin-${match[1]}`;
    }
    const slug = `${job.company}-${job.title}-${job.location}`.replace(/\s+/g, "-").toLowerCase();
    return `linkedin-${slug}-${Date.now()}`;
  }

  function buildCapturePayload(job) {
    const extractedFacts = {};
    if (job.description) {
      extractedFacts.description = job.description;
    }
    if (job.experienceLevel) {
      extractedFacts.experience_level = job.experienceLevel;
    }
    if (Array.isArray(job.industries) && job.industries.length > 0) {
      extractedFacts.industries = job.industries;
    }
    if (job.companyId) {
      extractedFacts.company_id = job.companyId;
    }
    if (job.companyUrl) {
      extractedFacts.company_url = job.companyUrl;
    }
    if (job.salaryMin || job.salaryMax) {
      extractedFacts.salary = {
        min: job.salaryMin,
        max: job.salaryMax,
      };
    }

    return {
      source_id: buildSourceId(job),
      source_url: job.link,
      captured_at: new Date().toISOString(),
      company: job.company,
      role_title: job.title,
      location: job.location,
      work_model: job.workplaceType || "",
      source_class: "linkedin_job",
      capture_method: "unattended_scan",
      why_captured: "",
      extracted_facts: extractedFacts,
      fit_hypothesis: "",
    };
  }

  async function postBatch(jobs, captureServerUrl) {
    const url = `${captureServerUrl}/batch`;
    const payloads = jobs.map(buildCapturePayload);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs: payloads }),
      });

      if (!response.ok) {
        throw new Error(`Capture server responded ${response.status}`);
      }

      reportStatus({ type: "batchPosted", count: payloads.length, url });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.errors.push({ url, message, at: new Date().toISOString() });
      reportStatus({ type: "batchError", message, url });
      return { success: false, message };
    }
  }

  async function humanLikeScroll(options = {}) {
    const steps = options.steps ?? 3;
    const stepDelayMs = options.stepDelayMs ?? 500;
    const maxScroll = Math.max(
      document.documentElement.scrollHeight - document.documentElement.clientHeight,
      0,
    );

    if (maxScroll <= 0) {
      return;
    }

    for (let i = 1; i <= steps; i++) {
      const y = Math.floor((maxScroll / steps) * i);
      window.scrollTo(0, y);
      await wait(stepDelayMs);
      if (state.shouldStop) {
        break;
      }
    }
  }

  function jobKey(job) {
    return job.link || `${job.company}-${job.title}-${job.location}`;
  }

  async function collectCurrentPage(options = {}) {
    const scraper = getScraper();
    if (!scraper || typeof scraper.collectJobs !== "function") {
      return { collected: 0, errors: [{ message: "LinkedIn scraper not available" }] };
    }

    const batchSize = options.batchSize ?? 3;
    const delayRangeMs = options.delayRangeMs ?? [6000, 10000];
    const cooldownAfterBatchMs = options.cooldownAfterBatchMs ?? 20000;
    const captureServerUrl = options.captureServerUrl ?? DEFAULT_CAPTURE_SERVER_URL;
    const maxScrollCycles = options.maxScrollCycles ?? 3;
    const scrollWaitMs = options.scrollWaitMs ?? 1500;

    const scrollOptions = options.scrollOptions ?? { steps: 3, stepDelayMs: 500 };
    const seen = new Set();
    const allJobs = [];

    for (let cycle = 0; cycle < maxScrollCycles; cycle += 1) {
      if (state.shouldStop) {
        break;
      }

      await humanLikeScroll(scrollOptions);

      // Give LinkedIn's lazy loader a moment to render new cards.
      if (scrollWaitMs) {
        await wait(scrollWaitMs);
      }

      const jobs = scraper.collectJobs({});
      let newInCycle = 0;
      jobs.forEach((job) => {
        const key = jobKey(job);
        if (!seen.has(key)) {
          seen.add(key);
          allJobs.push(job);
          newInCycle += 1;
        }
      });

      reportStatus({ type: "scrollCycle", cycle, newInCycle, total: allJobs.length });

      // Stop early if no new cards appeared in this cycle.
      if (newInCycle === 0 && cycle > 0) {
        break;
      }
    }

    const total = allJobs.length;
    const errors = [];

    for (let i = 0; i < total; i += batchSize) {
      if (state.shouldStop) {
        break;
      }

      if (delayRangeMs) {
        await wait(randomBetween(delayRangeMs));
      }

      const batch = allJobs.slice(i, i + batchSize);
      const result = await postBatch(batch, captureServerUrl);
      if (!result.success) {
        errors.push({ message: result.message });
      }

      if (i + batchSize < total && cooldownAfterBatchMs) {
        await wait(cooldownAfterBatchMs);
      }
    }

    return { collected: total, errors };
  }

  async function start(plan) {
    if (state.isRunning) {
      return { started: false, reason: "already running" };
    }

    state.isRunning = true;
    state.shouldStop = false;
    state.errors = [];
    state.plan = plan;
    state.currentQueryIndex = 0;

    const queries = plan?.queries ?? [];
    const pacing = plan?.pacing ?? {};
    const querySpacingMs = pacing.querySpacingMs ?? [30000, 60000];
    const postNavigateWaitMs = plan?.postNavigateWaitMs ?? 1000;
    const defaultCaptureServerUrl = plan?.captureServerUrl ?? DEFAULT_CAPTURE_SERVER_URL;

    reportStatus({ type: "started", queryCount: queries.length });

    try {
      for (let i = 0; i < queries.length; i++) {
        if (state.shouldStop) {
          break;
        }

        state.currentQueryIndex = i;
        const query = queries[i];
        const captureServerUrl = query.captureServerUrl ?? defaultCaptureServerUrl;

        reportStatus({ type: "queryStarted", index: i, query });

        if (query.url) {
          try {
            window.location.href = query.url;
          } catch (error) {
            // jsdom and some test environments do not implement navigation;
            // real browsers handle this normally.
            reportStatus({ type: "navigateMock", message: String(error) });
          }
          // After navigation the content script will reload; real continuation
          // relies on the service worker re-triggering with saved state.
          // For single-page tests, collection happens on the current DOM below.
          if (postNavigateWaitMs) {
            await wait(postNavigateWaitMs);
          }
        }

        if (state.shouldStop) {
          break;
        }

        await collectCurrentPage({
          batchSize: pacing.batchSize,
          delayRangeMs: pacing.delayRangeMs,
          cooldownAfterBatchMs: pacing.cooldownAfterBatchMs,
          scrollOptions: pacing.scrollOptions,
          scrollWaitMs: pacing.scrollWaitMs,
          maxScrollCycles: pacing.maxScrollCycles,
          captureServerUrl,
        });

        if (i < queries.length - 1) {
          await wait(randomBetween(querySpacingMs));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.errors.push({ message, at: new Date().toISOString() });
      reportStatus({ type: "fatalError", message });
    } finally {
      state.isRunning = false;
      state.shouldStop = false;
      reportStatus({ type: "finished", errors: state.errors });
    }

    return { started: true, collected: state.errors.length === 0 };
  }

  function stop() {
    state.shouldStop = true;
    state.isRunning = false;
    reportStatus({ type: "stopped" });
  }

  function getState() {
    return {
      isRunning: state.isRunning,
      currentQueryIndex: state.currentQueryIndex,
      errors: [...state.errors],
      plan: state.plan,
    };
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== "object") {
        return false;
      }

      switch (message.action) {
      case "startAutoScan":
        start(message.plan).catch(() => {});
        sendResponse({ success: true, started: true });
        return true;
      case "stopAutoScan":
        stop();
        sendResponse({ success: true, stopped: true });
        return true;
      case "getAutoScanState":
        sendResponse({ success: true, state: getState() });
        return true;
      default:
        return false;
      }
    });
  }

  window.__jswAutoScanInitialized = true;

  window.WorkflowAutoScan = {
    start,
    stop,
    getState,
    collectCurrentPage,
    humanLikeScroll,
  };
})();
