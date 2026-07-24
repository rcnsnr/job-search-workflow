// tests/dom.test.js
// DOM/Integration tests using jsdom

/**
 * @jest-environment jsdom
 */

describe("DOM Integration Tests", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("Job Card Detection", () => {
    const selectors = [
      "li.jobs-search-results__list-item",
      "li.scaffold-layout__list-item",
      "li.job-card-container",
      "li[data-occludable-job-id]",
      "div.job-card-container",
      ".jobs-search-results-list > li",
      ".scaffold-layout__list-container li",
    ];

    const getJobCards = () => {
      let cards = [];
      for (const selector of selectors) {
        cards = Array.from(document.querySelectorAll(selector));
        if (cards.length > 0) {
          break;
        }
      }
      return cards;
    };

    test("should find cards with jobs-search-results__list-item selector", () => {
      document.body.innerHTML = `
        <ul class="jobs-search-results__list">
          <li class="jobs-search-results__list-item">Job 1</li>
          <li class="jobs-search-results__list-item">Job 2</li>
        </ul>
      `;

      const cards = getJobCards();
      expect(cards.length).toBe(2);
    });

    test("should find cards with scaffold-layout__list-item selector (recommended page)", () => {
      document.body.innerHTML = `
        <div class="scaffold-layout__list">
          <li class="scaffold-layout__list-item">Job 1</li>
          <li class="scaffold-layout__list-item">Job 2</li>
          <li class="scaffold-layout__list-item">Job 3</li>
        </div>
      `;

      const cards = getJobCards();
      expect(cards.length).toBe(3);
    });

    test("should find cards with data-occludable-job-id attribute", () => {
      document.body.innerHTML = `
        <ul>
          <li data-occludable-job-id="123">Job 1</li>
          <li data-occludable-job-id="456">Job 2</li>
        </ul>
      `;

      const cards = getJobCards();
      expect(cards.length).toBe(2);
    });

    test("should find cards in scaffold-layout__list-container", () => {
      document.body.innerHTML = `
        <div class="scaffold-layout__list-container">
          <li>Job 1</li>
          <li>Job 2</li>
          <li>Job 3</li>
          <li>Job 4</li>
        </div>
      `;

      const cards = getJobCards();
      expect(cards.length).toBe(4);
    });

    test("should return empty array when no cards found", () => {
      document.body.innerHTML = `<div>No jobs here</div>`;

      const cards = getJobCards();
      expect(cards.length).toBe(0);
    });

    test("should prioritize first matching selector", () => {
      document.body.innerHTML = `
        <ul class="jobs-search-results__list">
          <li class="jobs-search-results__list-item">Search Job</li>
        </ul>
        <div class="scaffold-layout__list-container">
          <li>Recommended Job 1</li>
          <li>Recommended Job 2</li>
        </div>
      `;

      const cards = getJobCards();
      // First matching selector (jobs-search-results__list-item) should be used
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toBe("Search Job");
    });
  });

  describe("Job Data Extraction", () => {
    const findElement = (parent, selectorList) => {
      for (const selector of selectorList) {
        const element = parent.querySelector(selector);
        if (element) {
          return element;
        }
      }
      return null;
    };

    const titleSelectors = [
      "a.job-card-list__title",
      "a.job-card-container__link",
      ".job-card-list__title",
      "h3.job-card-list__title",
      "[data-test-job-title]",
      ".artdeco-entity-lockup__title a",
    ];

    const companySelectors = [
      "a.job-card-container__company-name",
      ".job-card-container__company-name",
      "[data-test-job-company-name]",
      ".artdeco-entity-lockup__subtitle",
    ];

    const locationSelectors = [
      "ul.job-card-container__metadata li",
      ".job-card-container__metadata-item",
      "[data-test-job-location]",
      ".artdeco-entity-lockup__caption",
    ];

    const extractJob = (card) => {
      const titleElement = findElement(card, titleSelectors);
      const companyElement = findElement(card, companySelectors);
      const locationElement = findElement(card, locationSelectors);

      return {
        title: titleElement?.textContent?.trim() ?? "",
        company: companyElement?.textContent?.trim() ?? "",
        location: locationElement?.textContent?.trim() ?? "",
      };
    };

    test("should extract job data from search results card", () => {
      document.body.innerHTML = `
        <li class="jobs-search-results__list-item">
          <a class="job-card-list__title" href="/jobs/123">Senior Developer</a>
          <a class="job-card-container__company-name">Tech Corp</a>
          <ul class="job-card-container__metadata">
            <li>Istanbul, Turkey</li>
          </ul>
        </li>
      `;

      const card = document.querySelector("li");
      const job = extractJob(card);

      expect(job.title).toBe("Senior Developer");
      expect(job.company).toBe("Tech Corp");
      expect(job.location).toBe("Istanbul, Turkey");
    });

    test("should extract job data from recommended page card", () => {
      document.body.innerHTML = `
        <li class="scaffold-layout__list-item">
          <div class="artdeco-entity-lockup__title">
            <a href="/jobs/456">Full Stack Engineer</a>
          </div>
          <div class="artdeco-entity-lockup__subtitle">Startup Inc</div>
          <div class="artdeco-entity-lockup__caption">Remote</div>
        </li>
      `;

      const card = document.querySelector("li");
      const job = extractJob(card);

      expect(job.title).toBe("Full Stack Engineer");
      expect(job.company).toBe("Startup Inc");
      expect(job.location).toBe("Remote");
    });

    test("should extract job data with data-test attributes", () => {
      document.body.innerHTML = `
        <li>
          <span data-test-job-title>Backend Developer</span>
          <span data-test-job-company-name>Big Company</span>
          <span data-test-job-location>San Francisco, CA</span>
        </li>
      `;

      const card = document.querySelector("li");
      const job = extractJob(card);

      expect(job.title).toBe("Backend Developer");
      expect(job.company).toBe("Big Company");
      expect(job.location).toBe("San Francisco, CA");
    });

    test("should handle missing elements gracefully", () => {
      document.body.innerHTML = `
        <li class="job-card">
          <a class="job-card-list__title">Only Title</a>
        </li>
      `;

      const card = document.querySelector("li");
      const job = extractJob(card);

      expect(job.title).toBe("Only Title");
      expect(job.company).toBe("");
      expect(job.location).toBe("");
    });

    test("should trim whitespace from extracted text", () => {
      document.body.innerHTML = `
        <li>
          <a class="job-card-list__title">
            
            Software Engineer   
            
          </a>
          <span class="job-card-container__company-name">  Company Name  </span>
        </li>
      `;

      const card = document.querySelector("li");
      const job = extractJob(card);

      expect(job.title).toBe("Software Engineer");
      expect(job.company).toBe("Company Name");
    });
  });

  describe("Page Type Detection", () => {
    const detectPageType = (url) => {
      const pathname = new URL(url).pathname;

      if (pathname.includes("/jobs/search")) {
        return "search";
      }

      if (pathname.includes("/jobs/collections")) {
        return "collections";
      }

      if (pathname.includes("/jobs/")) {
        return "generic";
      }

      return "unknown";
    };

    test("should detect search page", () => {
      expect(detectPageType("https://www.linkedin.com/jobs/search/?keywords=developer")).toBe("search");
    });

    test("should detect collections/recommended page", () => {
      expect(detectPageType("https://www.linkedin.com/jobs/collections/recommended/")).toBe("collections");
    });

    test("should detect collections/applied page", () => {
      expect(detectPageType("https://www.linkedin.com/jobs/collections/applied/")).toBe("collections");
    });

    test("should detect generic jobs page", () => {
      expect(detectPageType("https://www.linkedin.com/jobs/view/123456")).toBe("generic");
    });

    test("should return unknown for non-jobs pages", () => {
      expect(detectPageType("https://www.linkedin.com/feed/")).toBe("unknown");
      expect(detectPageType("https://www.linkedin.com/in/username/")).toBe("unknown");
    });
  });

  describe("Filter UI Simulation", () => {
    test("should create and populate filter form", () => {
      document.body.innerHTML = `
        <form id="filterForm">
          <input type="text" id="keywords" value="">
          <input type="text" id="location" value="">
          <input type="checkbox" id="remoteOnly">
          <input type="number" id="minSalary" value="0">
          <button type="submit">Filter</button>
        </form>
      `;

      const keywordsInput = document.getElementById("keywords");
      const locationInput = document.getElementById("location");
      const remoteCheckbox = document.getElementById("remoteOnly");
      const minSalaryInput = document.getElementById("minSalary");

      // Simulate user input
      keywordsInput.value = "developer, engineer";
      locationInput.value = "Istanbul";
      remoteCheckbox.checked = true;
      minSalaryInput.value = "50000";

      expect(keywordsInput.value).toBe("developer, engineer");
      expect(locationInput.value).toBe("Istanbul");
      expect(remoteCheckbox.checked).toBe(true);
      expect(minSalaryInput.value).toBe("50000");
    });

    test("should handle form submission", () => {
      document.body.innerHTML = `
        <form id="filterForm">
          <input type="text" id="keywords" value="react">
          <button type="submit">Filter</button>
        </form>
        <div id="status"></div>
      `;

      const form = document.getElementById("filterForm");
      const statusDiv = document.getElementById("status");
      let formSubmitted = false;

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        formSubmitted = true;
        statusDiv.textContent = "Filters applied";
      });

      // Trigger submit
      form.dispatchEvent(new Event("submit"));

      expect(formSubmitted).toBe(true);
      expect(statusDiv.textContent).toBe("Filters applied");
    });
  });

  describe("Results Display", () => {
    test("should render job results list", () => {
      const jobs = [
        { title: "Developer", company: "Company A", location: "Istanbul" },
        { title: "Engineer", company: "Company B", location: "Ankara" },
      ];

      const renderJobs = (jobList) => {
        const container = document.createElement("ul");
        container.id = "results";

        jobList.forEach((job) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${job.title}</strong>
            <span>${job.company}</span>
            <span>${job.location}</span>
          `;
          container.appendChild(li);
        });

        return container;
      };

      const results = renderJobs(jobs);
      document.body.appendChild(results);

      const items = document.querySelectorAll("#results li");
      expect(items.length).toBe(2);
      expect(items[0].querySelector("strong").textContent).toBe("Developer");
      expect(items[1].querySelector("strong").textContent).toBe("Engineer");
    });

    test("should show empty state when no results", () => {
      const renderEmptyState = () => {
        const div = document.createElement("div");
        div.id = "empty-state";
        div.textContent = "No results found";
        return div;
      };

      document.body.appendChild(renderEmptyState());

      const emptyState = document.getElementById("empty-state");
      expect(emptyState).not.toBeNull();
      expect(emptyState.textContent).toBe("No results found");
    });

    test("should update result count", () => {
      document.body.innerHTML = `<span id="resultCount">0 ilan bulundu</span>`;

      const updateCount = (count) => {
        document.getElementById("resultCount").textContent = `${count} ilan bulundu`;
      };

      updateCount(15);
      expect(document.getElementById("resultCount").textContent).toBe("15 ilan bulundu");

      updateCount(0);
      expect(document.getElementById("resultCount").textContent).toBe("0 ilan bulundu");
    });
  });

  describe("Chrome Storage Mock", () => {
    // Mock chrome.storage.local
    const mockStorage = {};

    const chromeStorageMock = {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach((key) => {
            if (mockStorage[key] !== undefined) {
              result[key] = mockStorage[key];
            }
          });
        } else if (typeof keys === "string") {
          if (mockStorage[keys] !== undefined) {
            result[keys] = mockStorage[keys];
          }
        } else if (keys === null) {
          Object.assign(result, mockStorage);
        }
        callback(result);
      }),
      set: jest.fn((items, callback) => {
        Object.assign(mockStorage, items);
        if (callback) callback();
      }),
      remove: jest.fn((keys, callback) => {
        if (Array.isArray(keys)) {
          keys.forEach((key) => delete mockStorage[key]);
        } else {
          delete mockStorage[keys];
        }
        if (callback) callback();
      }),
      clear: jest.fn((callback) => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
        if (callback) callback();
      }),
    };

    beforeEach(() => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      jest.clearAllMocks();
    });

    test("should save filters to storage", (done) => {
      const filters = {
        keywords: ["react", "vue"],
        location: "Istanbul",
        remoteOnly: true,
      };

      chromeStorageMock.set({ filters }, () => {
        expect(chromeStorageMock.set).toHaveBeenCalledWith({ filters }, expect.any(Function));
        expect(mockStorage.filters).toEqual(filters);
        done();
      });
    });

    test("should retrieve filters from storage", (done) => {
      mockStorage.filters = {
        keywords: ["developer"],
        minSalary: 50000,
      };

      chromeStorageMock.get("filters", (result) => {
        expect(result.filters.keywords).toEqual(["developer"]);
        expect(result.filters.minSalary).toBe(50000);
        done();
      });
    });

    test("should clear storage", (done) => {
      mockStorage.filters = { test: true };
      mockStorage.cache = { data: "cached" };

      chromeStorageMock.clear(() => {
        expect(Object.keys(mockStorage).length).toBe(0);
        done();
      });
    });

    test("should remove specific keys", (done) => {
      mockStorage.filters = { test: true };
      mockStorage.cache = { data: "cached" };
      mockStorage.settings = { theme: "dark" };

      chromeStorageMock.remove(["cache", "settings"], () => {
        expect(mockStorage.filters).toBeDefined();
        expect(mockStorage.cache).toBeUndefined();
        expect(mockStorage.settings).toBeUndefined();
        done();
      });
    });
  });

  describe("Message Passing Mock", () => {
    test("should simulate message from popup to content script", () => {
      const messageHandler = jest.fn((message, sender, sendResponse) => {
        if (message.action === "collectJobs") {
          sendResponse({ jobs: [{ title: "Test Job" }], count: 1 });
        }
      });

      const sendResponse = jest.fn();
      messageHandler({ action: "collectJobs", filters: {} }, {}, sendResponse);

      expect(messageHandler).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        jobs: [{ title: "Test Job" }],
        count: 1,
      });
    });

    test("should simulate message from content script to service worker", () => {
      const serviceWorkerHandler = jest.fn((message, sender, sendResponse) => {
        if (message.action === "getCompanyInfo") {
          sendResponse({
            success: true,
            data: { name: "Test Company", employees: 100 },
          });
        }
      });

      const sendResponse = jest.fn();
      serviceWorkerHandler(
        { action: "getCompanyInfo", companyId: "123" },
        { tab: { id: 1 } },
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: { name: "Test Company", employees: 100 },
      });
    });
  });
});
