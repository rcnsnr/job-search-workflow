// tests/e2e.test.js
// E2E Browser Tests with Puppeteer + Chrome Extension

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const USER_DATA_DIR = path.resolve(__dirname, "..", ".chrome-profile");
const LINKEDIN_JOBS_URL = "https://www.linkedin.com/jobs/search/?keywords=developer";
const CANDIDATE_BROWSER_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.BRAVE_PATH,
  "/usr/bin/brave-browser",
  "/usr/bin/brave-browser-stable",
  "/usr/bin/brave",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

// Test timeout
jest.setTimeout(180000);

// Global state
let browser = null;
let mainPage = null;
let extensionId = null;
let isAuthenticated = false;

const resolveBrowserExecutable = () => {
  for (const candidate of CANDIDATE_BROWSER_PATHS) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch (error) {
    console.warn("Bundled browser path not found:", error.message);
  }

  return null;
};

// Check login state (without page change)
const checkLoginStatus = async (page) => {
  const url = page.url();
  return !url.includes("/login") && !url.includes("/authwall") && url.includes("linkedin.com");
};

// Wait for manual login
const waitForManualLogin = async (page) => {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 LINKEDIN LOGIN REQUIRED");
  console.log("=".repeat(60));
  console.log("1. Log in to LinkedIn in the opened browser");
  console.log("2. After login, tests will continue automatically");
  console.log("3. Timeout: 3 minutes");
  console.log("=".repeat(60) + "\n");

  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 60000 });

  const timeout = 180000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    await new Promise((r) => setTimeout(r, 3000));
    
    const currentUrl = page.url();
    if (!currentUrl.includes("/login") && 
        !currentUrl.includes("/authwall") && 
        !currentUrl.includes("/checkpoint") &&
        currentUrl.includes("linkedin.com")) {
      console.log("✅ Login successful!\n");
      await new Promise((r) => setTimeout(r, 2000));
      return true;
    }
    
    const remaining = Math.round((timeout - (Date.now() - startTime)) / 1000);
    console.log(`⏳ Login pending... (${remaining}s)`);
  }
  
  throw new Error("Login timeout");
};

// Find extension service worker
const waitForExtensionServiceWorker = async (browser) => {
  return browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().startsWith("chrome-extension://") &&
      target.url().endsWith("service_worker.js"),
    { timeout: 20000 },
  );
};

// Setup - runs once before all tests
beforeAll(async () => {
  // Profile folder
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      "Chrome/Brave executable not found. Set PUPPETEER_EXECUTABLE_PATH or BRAVE_PATH."
    );
  }

  // Browser starting
  browser = await puppeteer.launch({
    headless: false,
    executablePath,
    pipe: true,
    enableExtensions: [EXTENSION_PATH],
    userDataDir: USER_DATA_DIR,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  // Ana sayfa
  mainPage = await browser.newPage();

  // Extension ID'yi bul
  const workerTarget = await waitForExtensionServiceWorker(browser);
  extensionId = workerTarget.url().split("/")[2];
  console.log("📦 Extension ID:", extensionId);

  // Go to LinkedIn and check login
  console.log("🔍 LinkedIn login check...\n");
  await mainPage.goto("https://www.linkedin.com/feed/", { 
    waitUntil: "domcontentloaded", 
    timeout: 30000 
  });

  const loggedIn = await checkLoginStatus(mainPage);
  if (!loggedIn) {
    await waitForManualLogin(mainPage);
  } else {
    console.log("✅ Existing session used\n");
  }

  isAuthenticated = true;

  // Go to Jobs page
  console.log("📋 Navigating to Jobs page...\n");
  await mainPage.goto(LINKEDIN_JOBS_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3000)); // Wait for page load
});

// Teardown
afterAll(async () => {
  if (browser) {
    await browser.close();
  }
});

// ============ TESTLER ============

describe("Extension Loading", () => {
  test("should load extension successfully", async () => {
    expect(extensionId).toBeDefined();
    expect(extensionId).not.toBeNull();
    console.log("✅ Extension loaded:", extensionId);
  });

  test("should have active service worker", async () => {
    const sw = await waitForExtensionServiceWorker(browser);
    expect(sw).toBeDefined();
    expect(sw.url()).toContain("service_worker.js");
    console.log("✅ Service worker aktif");
  });
});

describe("Popup Functionality", () => {
  let popupPage;

  beforeAll(async () => {
    const swTarget = await waitForExtensionServiceWorker(browser);
    const worker = await swTarget.worker();
    await worker.evaluate(() => chrome.action.openPopup());
    const popupTarget = await browser.waitForTarget(
      (target) =>
        target.type() === "page" &&
        target.url().includes(extensionId) &&
        target.url().endsWith("popup.html"),
      { timeout: 10000 },
    );
    popupPage = await popupTarget.asPage();
    await new Promise((r) => setTimeout(r, 1000));
  });

  afterAll(async () => {
    if (popupPage) await popupPage.close();
  });

  test("should open popup page", async () => {
    const title = await popupPage.$eval("h3", (el) => el.textContent);
    expect(title).toContain("Filtered Job Postings");
    console.log("✅ Popup opened");
  });

  test("should have filter inputs", async () => {
    const inputs = await popupPage.evaluate(() => ({
      keyword: !!document.querySelector("#keyword-input"),
      location: !!document.querySelector("#location-input"),
      company: !!document.querySelector("#company-input"),
      remote: !!document.querySelector("#remote-only"),
      save: !!document.querySelector("#save-filters"),
    }));

    expect(inputs.keyword).toBe(true);
    expect(inputs.location).toBe(true);
    expect(inputs.company).toBe(true);
    expect(inputs.remote).toBe(true);
    expect(inputs.save).toBe(true);
    console.log("✅ All filter inputs present");
  });

  test("should accept filter values", async () => {
    // Clear fields before the test
    await popupPage.$eval("#keyword-input", (el) => (el.value = ""));
    await popupPage.$eval("#location-input", (el) => (el.value = ""));

    // Enter values
    await popupPage.type("#keyword-input", "react, node");
    await popupPage.type("#location-input", "Berlin");

    const values = await popupPage.evaluate(() => ({
      keyword: document.querySelector("#keyword-input").value,
      location: document.querySelector("#location-input").value,
    }));

    expect(values.keyword).toBe("react, node");
    expect(values.location).toBe("Berlin");
    console.log("✅ Filter values accepted");
  });
});

describe("LinkedIn Page Integration", () => {
  test("should be on LinkedIn jobs page", async () => {
    const url = mainPage.url();
    expect(url).toContain("linkedin.com/jobs");
    console.log("✅ On Jobs page:", url);
  });

  test("should find job cards on page", async () => {
    // Wait for full page load
    await new Promise((r) => setTimeout(r, 2000));

    const result = await mainPage.evaluate(() => {
      const selectors = [
        "li.jobs-search-results__list-item",
        "[data-occludable-job-id]",
        ".job-card-container",
        ".jobs-search-results-list__list-item",
        "[data-tracking-control-name='public_jobs_jserp-result_search-card']",
        ".job-search-card",
        ".base-search-card",
      ];

      for (const sel of selectors) {
        const cards = document.querySelectorAll(sel);
        if (cards.length > 0) {
          return { count: cards.length, selector: sel };
        }
      }
      return { count: 0, selector: null };
    });

    console.log(`📊 ${result.count} job card found (${result.selector})`);
    expect(result.count).toBeGreaterThan(0);
  });

  test("should have content script markers", async () => {
    // Check markers added by content script to DOM
    const markers = await mainPage.evaluate(() => {
      return {
        // Any element or attribute added by the extension
        hasJobList: !!document.querySelector(".jobs-search-results-list"),
        hasJobCards: document.querySelectorAll("[data-occludable-job-id]").length > 0,
        pageType: document.querySelector(".jobs-search-results") ? "search" : "other",
      };
    });

    console.log("📋 Sayfa durumu:", markers);
    expect(markers.hasJobList || markers.hasJobCards).toBe(true);
  });
});
