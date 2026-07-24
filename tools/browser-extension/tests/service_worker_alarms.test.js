// tests/service_worker_alarms.test.js
// Service worker alarm handler and auto-scan messaging tests

describe("service worker alarm handler", () => {
  let mockStorage;
  let messageListeners;
  let alarmListeners;
  let createdAlarms;
  let tabs;

  beforeEach(() => {
    mockStorage = {};
    messageListeners = [];
    alarmListeners = [];
    createdAlarms = [];
    tabs = [];

    global.Logger = jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));

    global.importScripts = jest.fn();

    global.chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn((handler) => messageListeners.push(handler)),
        },
        onInstalled: {
          addListener: jest.fn(),
        },
      },
      alarms: {
        onAlarm: {
          addListener: jest.fn((handler) => alarmListeners.push(handler)),
        },
        create: jest.fn((name, options) => {
          createdAlarms.push({ name, options });
          return Promise.resolve();
        }),
        clear: jest.fn(() => Promise.resolve(true)),
        getAll: jest.fn(() => Promise.resolve([])),
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
            if (callback) callback(result);
            return Promise.resolve(result);
          }),
          set: jest.fn((items, callback) => {
            Object.assign(mockStorage, items);
            if (callback) callback();
            return Promise.resolve();
          }),
          remove: jest.fn((keys, callback) => {
            if (Array.isArray(keys)) {
              keys.forEach((key) => delete mockStorage[key]);
            } else {
              delete mockStorage[keys];
            }
            if (callback) callback();
            return Promise.resolve();
          }),
        },
      },
      tabs: {
        query: jest.fn((queryInfo, callback) => {
          const matched = tabs.filter((tab) => {
            if (queryInfo.url && !tab.url?.includes(queryInfo.url.replace(/\*/g, ""))) {
              return false;
            }
            return true;
          });
          if (callback) callback(matched);
          return Promise.resolve(matched);
        }),
        create: jest.fn((createInfo, callback) => {
          const newTab = { id: 42, url: createInfo.url };
          tabs.push(newTab);
          if (callback) callback(newTab);
          return Promise.resolve(newTab);
        }),
        sendMessage: jest.fn(() => Promise.resolve({ success: true })),
      },
      scripting: {
        executeScript: jest.fn(() => Promise.resolve()),
      },
    };

    jest.isolateModules(() => {
      require("../service_worker.js");
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.chrome;
    delete global.Logger;
    delete global.importScripts;
  });

  function dispatchMessage(message) {
    const sendResponse = jest.fn();
    for (const listener of messageListeners) {
      listener(message, { tab: { id: 1 } }, sendResponse);
    }
    return sendResponse;
  }

  function dispatchAlarm(alarm) {
    for (const listener of alarmListeners) {
      listener(alarm);
    }
  }

  it("registers runtime and alarm listeners", () => {
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
  });

  it("startAutoScan creates an alarm and stores the plan", async () => {
    const plan = {
      queries: [{ id: "q1", url: "https://www.linkedin.com/jobs/search/?keywords=sre" }],
      captureServerUrl: "http://localhost:8766",
    };

    const sendResponse = dispatchMessage({
      action: "startAutoScan",
      plan,
      periodInMinutes: 60,
    });

    // Wait for async storage set / alarm create
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      "unattendedScan",
      expect.objectContaining({ periodInMinutes: 60 })
    );
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ autoScanPlan: plan, autoScanEnabled: true })
    );
  });

  it("stopAutoScan clears the alarm and disables the flag", async () => {
    const sendResponse = dispatchMessage({ action: "stopAutoScan" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(chrome.alarms.clear).toHaveBeenCalledWith("unattendedScan");
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ autoScanEnabled: false })
    );
  });

  it("getAutoScanState returns stored state", async () => {
    mockStorage.autoScanEnabled = true;
    mockStorage.autoScanPlan = { queries: [] };

    const sendResponse = dispatchMessage({ action: "getAutoScanState" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        state: expect.objectContaining({ enabled: true, plan: { queries: [] } }),
      })
    );
  });

  it("alarm handler opens a LinkedIn tab if none exists and starts scan", async () => {
    const plan = {
      queries: [{ id: "q1", url: "https://www.linkedin.com/jobs/search/?keywords=sre" }],
      captureServerUrl: "http://localhost:8766",
    };
    mockStorage.autoScanEnabled = true;
    mockStorage.autoScanPlan = plan;

    dispatchAlarm({ name: "unattendedScan" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: plan.queries[0].url, active: false })
    );
    expect(chrome.scripting.executeScript).toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ action: "startAutoScan", plan })
    );
  });

  it("alarm handler reuses an existing LinkedIn tab", async () => {
    tabs.push({ id: 7, url: "https://www.linkedin.com/jobs/search/?keywords=platform" });

    const plan = {
      queries: [{ id: "q1", url: "https://www.linkedin.com/jobs/search/?keywords=sre" }],
      captureServerUrl: "http://localhost:8766",
    };
    mockStorage.autoScanEnabled = true;
    mockStorage.autoScanPlan = plan;

    dispatchAlarm({ name: "unattendedScan" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ action: "startAutoScan", plan })
    );
  });
});
