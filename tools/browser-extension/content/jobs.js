// in-job-search-addon-chrome/content/jobs.js
(function () {
  if (window.__linkedInJobScraperInitialized) {
    return;
  }

  function extractDescription(card) {
    const descriptionElement = card.querySelector(
      ".job-card-list__description, .job-card__description, [data-test-job-description]",
    );
    const snippetElement = card.querySelector(
      ".job-search-card__snippet, p.job-search-card__snippet, .job-card__snippet, [data-test-job-card-snippet]",
    );
    const benefitsElement = card.querySelector(".job-posting-benefits__text, .job-card__benefits");
    const insightElement = card.querySelector("[data-test-description], [data-test-job-insight]");
    const fallbackElement = card.querySelector(
      ".job-card-container__main-content, .base-search-card, .job-card__main-content",
    );

    const texts = [];
    if (descriptionElement?.textContent) {
      texts.push(descriptionElement.textContent);
    }
    if (snippetElement?.textContent) {
      texts.push(snippetElement.textContent);
    }
    if (benefitsElement?.textContent) {
      texts.push(benefitsElement.textContent);
    }
    if (insightElement?.textContent) {
      texts.push(insightElement.textContent);
    }
    if (fallbackElement?.textContent) {
      texts.push(fallbackElement.textContent);
    }
    if (texts.length === 0 && card?.textContent) {
      texts.push(card.textContent);
    }

    return normalizeWhitespace(texts.join("\n"));
  }

  function matchWhitelist(job, whitelist) {
    if (!Array.isArray(whitelist) || whitelist.length === 0) {
      return true;
    }

    const textPool = buildTextPool(job);
    return whitelist.some((item) => {
      const normalized = normalizeWhitespace(item).toLowerCase();
      return textPool.has(normalized);
    });
  }

  function matchBlacklist(job, blacklist) {
    if (!Array.isArray(blacklist) || blacklist.length === 0) {
      return true;
    }

    const textPool = buildTextPool(job);
    return blacklist.every((item) => {
      const normalized = normalizeWhitespace(item).toLowerCase();
      return !textPool.has(normalized);
    });
  }

  function matchCompanyOrigin(origin, filterValue) {
    const normalizedFilter = filterValue ?? "any";
    if (normalizedFilter === "any" || !normalizedFilter) {
      return true;
    }

    const effectiveOrigin = origin ?? "direct";

    if (normalizedFilter === "direct") {
      return effectiveOrigin === "direct";
    }

    if (normalizedFilter === "outsourcing") {
      return effectiveOrigin === "outsourcing";
    }

    if (normalizedFilter === "exclude-outsourcing") {
      return effectiveOrigin !== "outsourcing";
    }

    return true;
  }

  function buildTextPool(job) {
    const pool = new Set();

    const pushText = (value) => {
      if (!value) {
        return;
      }

      const normalized = normalizeWhitespace(value).toLowerCase();
      if (normalized) {
        pool.add(normalized);
      }

      const tokens = tokenize(value);
      tokens.forEach((token) => {
        pool.add(token);
      });

      const maxWindow = Math.min(4, tokens.length);
      for (let size = 2; size <= maxWindow; size += 1) {
        const windows = slidingWindows(tokens, size);
        windows.forEach((window) => {
          pool.add(window);
        });
      }
    };

    pushText(job.title);
    pushText(job.description);
    pushText(job.workplaceType);
    pushText(job.location);
    pushText(job.company);

    return pool;
  }

  function classifyCompanyOrigin(job) {
    const signals = {
      outsourcing: [],
    };

    const normalizedCompany = normalizeWhitespace(job.company ?? "").toLowerCase();
    const normalizedSlug = normalizeWhitespace(job.companySlug ?? "").toLowerCase();
    const textPool = buildTextPool(job);

    OUTSOURCING_COMPANY_KEYWORDS.forEach((keyword) => {
      if (!keyword) {
        return;
      }

      if (normalizedCompany.includes(keyword)) {
        signals.outsourcing.push(`company:${keyword}`);
      } else if (normalizedSlug && normalizedSlug.includes(keyword.replace(/\s+/g, ""))) {
        signals.outsourcing.push(`slug:${keyword}`);
      } else if (textPool.has(keyword)) {
        signals.outsourcing.push(`text:${keyword}`);
      }
    });

    OUTSOURCING_PHRASES.forEach((phrase) => {
      if (!phrase) {
        return;
      }

      const normalizedPhrase = normalizeWhitespace(phrase).toLowerCase();
      if (textPool.has(normalizedPhrase)) {
        signals.outsourcing.push(`phrase:${normalizedPhrase}`);
      }
    });

    if (signals.outsourcing.length > 0) {
      return {
        origin: "outsourcing",
        signals,
      };
    }

    return {
      origin: "direct",
      signals,
    };
  }

  window.__linkedInJobScraperInitialized = true;

  const FUZZY_THRESHOLD = 0.72;
  const KEYWORD_SYNONYM_GROUPS = [
    ["software engineer", "software developer", "developer", "software engineer"],
    ["frontend developer", "front-end developer", "frontend engineer", "ui engineer"],
    ["backend developer", "back-end developer", "backend engineer", "server-side developer"],
    ["full stack developer", "fullstack developer", "full-stack developer"],
    ["data scientist", "data science", "ml engineer", "machine learning engineer"],
    ["product manager", "product manager", "product owner"],
    ["devops engineer", "devops", "site reliability engineer", "sre", "platform engineer"],
  ];
  const EXPERIENCE_SYNONYM_GROUPS = [
    ["entry level", "junior", "associate"],
    ["senior", "lead", "principal"],
    ["director", "executive"],
  ];

  const KEYWORD_SYNONYM_MAP = buildSynonymMap(KEYWORD_SYNONYM_GROUPS);
  const REMOTE_POSITIVE_HINTS = [
    "remote",
    "uzaktan",
    "home office",
    "fully remote",
    "remote-first",
    "work from home",
  ];
  const REMOTE_NEGATIVE_HINTS = [
    "on-site",
    "onsite",
    "ofiste",
    "hybrid",
    "shift",
    "travel required",
  ];
  const OUTSOURCING_COMPANY_KEYWORDS = [
    "consult",
    "consultancy",
    "consulting",
    "outsourcing",
    "staffing",
    "recruitment",
    "recruiting",
    "hr",
    "human resources",
    "talent acquisition",
    "agency",
    "bpo",
  ];
  const OUTSOURCING_PHRASES = [
    "hiring for our client",
    "on behalf of our client",
    "on behalf of",
    "for our customer",
    "third party",
    "outsourced",
    "contract staffing",
    "body shop",
  ];

  const EXPERIENCE_SYNONYM_MAP = buildSynonymMap(EXPERIENCE_SYNONYM_GROUPS);

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === "collectJobs") {
      try {
        const jobs = collectJobs(request.filters ?? {});
        sendResponse({ jobs });
      } catch (error) {
        console.error("Job collection error", error);
        sendResponse({ jobs: [], error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
    return false;
  });

  function detectPageType() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    if (pathname.includes("/jobs/search")) {
      return "search";
    }

    if (pathname.includes("/jobs/collections")) {
      return "collections";
    }

    if (url.includes("/jobs/") && document.querySelector(".scaffold-layout__list")) {
      return "generic";
    }

    return "unknown";
  }

  function getJobCards() {
    const pageType = detectPageType();
    const selectors = [
      // 2025-2026 current selectors (AI search and new search experience)
      "[data-tracking-control-name='public_jobs_jserp-result_search-card']",
      "[data-view-name='search-entity-result-universal-template']",
      "li[data-occludable-job-id]",
      ".jobs-search-results-list li.jobs-search-results__list-item",
      // Authenticated user pages
      "ul.jobs-search__results-list > li",
      "li.jobs-search-results__list-item",
      "li.scaffold-layout__list-item",
      "li.job-card-container",
      "div.job-card-container",
      "div.job-card-list",
      ".job-card-list",
      ".jobs-search-results-list > li",
      ".jobs-search__results-list li",
      // AI / natural language search result cards
      ".jobs-search-results__job-card",
      "[data-test-job-card]",
      ".job-card",
      // Public/Guest pages
      ".job-search-card",
      "div.base-search-card.job-search-card",
      "div.base-card.job-search-card",
      ".base-card.relative.job-search-card",
      // Fallback
      ".scaffold-layout__list-container li",
      ".jobs-search__list-container li",
    ];

    let cards = [];
    for (const selector of selectors) {
      cards = Array.from(document.querySelectorAll(selector))
        .map((element) => {
          if (!element) {
            return null;
          }
          if (element.matches(".job-search-card, .base-search-card, .job-card-container")) {
            return element;
          }
          const nested = element.querySelector(".job-search-card, .base-search-card, .job-card-container");
          return nested ?? element;
        })
        .filter(Boolean);

      const unique = Array.from(new Set(cards));
      cards = unique;

      if (cards.length > 0) {
        console.log(`[LinkedIn Job Filter] ${cards.length} job cards found (selector: ${selector}, page: ${pageType})`);
        break;
      }
    }

    if (cards.length === 0) {
      console.warn("[LinkedIn Job Filter] No job cards found. Page type:", pageType);
      console.warn("[LinkedIn Job Filter] Please make sure you are on a LinkedIn Jobs search or recommendations page.");
    }

    return cards;
  }

  function findElement(parent, selectors) {
    for (const selector of selectors) {
      const element = parent.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function collectJobs(filters) {
    const cards = getJobCards();
    const jobs = [];

    cards.forEach((card) => {
      const job = extractJob(card);

      if (passesFilters(job, filters)) {
        jobs.push(job);
      }
    });

    console.log(`[LinkedIn Job Filter] ${cards.length} cards scanned, ${jobs.length} jobs passed filter`);
    return jobs;
  }

  function extractJob(card) {
    const titleSelectors = [
      "a.job-card-list__title",
      "a.job-card-container__link",
      ".job-card-list__title",
      "h3.job-card-list__title",
      "[data-test-job-title]",
      "[data-test-job-card-title]",
      ".artdeco-entity-lockup__title a",
      "h3.base-search-card__title",
      ".base-search-card__title",
      ".job-search-card__title",
      ".job-search-card__title-link",
      "a.base-card__full-link",
      "a.job-card__title",
      ".job-card__title",
      "h3.job-card__title",
      "h3 a",
    ];
    const companySelectors = [
      "a.job-card-container__company-name",
      ".job-card-container__company-name",
      "[data-test-job-company-name]",
      "[data-test-job-card-company]",
      ".artdeco-entity-lockup__subtitle",
      ".base-search-card__subtitle a",
      ".base-search-card__subtitle",
      ".job-card__company-name",
      ".job-card__subtitle",
      "a.hidden-nested-link",
    ];
    const locationSelectors = [
      "ul.job-card-container__metadata li",
      ".job-card-container__metadata-item",
      "[data-test-job-location]",
      "[data-test-job-card-location]",
      ".artdeco-entity-lockup__caption",
      ".job-search-card__location",
      ".job-card__location",
      ".base-search-card__metadata span",
      ".job-card__metadata",
    ];

    const titleElement = findElement(card, titleSelectors);
    const companyElement = findElement(card, companySelectors);
    const locationElement = findElement(card, locationSelectors);
    const listedAt = card.querySelector("time");
    const fullCardLink = card.querySelector("a.base-card__full-link, a.job-card-container__link");
    const companyUrl = companyElement?.href ?? companyElement?.querySelector("a")?.href ?? "";
    const companyUrn = companyElement?.getAttribute("data-entity-urn")
      ?? card.getAttribute("data-entity-urn")
      ?? card.getAttribute("data-occludable-job-id")
      ?? "";
    const companyId = extractCompanyIdFromUrn(companyUrn);
    const companySlug = extractCompanySlugFromUrl(companyUrl);

    const description = extractDescription(card);

    const baseJob = {
      title: titleElement?.textContent?.trim() ?? "",
      company: companyElement?.textContent?.trim() ?? "",
      location: locationElement?.textContent?.trim() ?? "",
      link: titleElement?.href ?? fullCardLink?.href ?? titleElement?.closest("a")?.href ?? "",
      postedAt: listedAt?.getAttribute("datetime") ?? "",
      workplaceType: determineWorkplaceType(card),
      experienceLevel: determineExperienceLevel(card),
      industries: determineIndustries(card),
      ...determineSalary(card),
      companyUrl,
      companySlug,
      companyId,
      description,
    };
    const originInfo = classifyCompanyOrigin(baseJob);

    return {
      ...baseJob,
      companyOrigin: originInfo.origin,
      companyOriginSignals: originInfo.signals,
    };
  }

  function passesFilters(job, filters) {
    const keywordPass = matchKeywords(job.title, filters.keywords);
    const locationPass = matchLocation(job.location, filters.location);
    const companyPass = matchCompany(job.company, filters.company);
    const remotePass = filters.remoteOnly ? matchRemote(job) : true;
    const agePass = matchMaxAge(job.postedAt, filters.maxAgeDays);
    const experiencePass = matchExperience(job.experienceLevel, filters.experience);
    const industryPass = matchIndustry(job.industries, filters.industry);
    const salaryPass = matchMinSalary(job, filters.minSalary);
    const whitelistPass = matchWhitelist(job, filters.keywordWhitelist);
    const blacklistPass = matchBlacklist(job, filters.keywordBlacklist);
    const originPass = matchCompanyOrigin(job.companyOrigin, filters.companyOrigin);

    return keywordPass && locationPass && companyPass && remotePass && agePass && experiencePass && industryPass && salaryPass && whitelistPass && blacklistPass && originPass;
  }

  function matchKeywords(title, keywords) {
    return matchAgainstValue(title, keywords, getKeywordVariants);
  }

  function matchLocation(location, filter) {
    return matchAgainstValue(location, filter);
  }

  function matchCompany(company, filter) {
    return matchAgainstValue(company, filter);
  }

  function matchExperience(experienceLevel, filter) {
    return matchAgainstValue(experienceLevel, filter, getExperienceVariants);
  }

  function matchIndustry(industries, filter) {
    if (!filter) {
      return true;
    }
    const terms = parseFilterList(filter);
    if (terms.length === 0) {
      return true;
    }

    const pool = Array.isArray(industries) ? industries : [industries];
    const normalizedPool = pool.filter(Boolean).map((item) => item.toLowerCase());
    if (normalizedPool.length === 0) {
      return false;
    }

    const tokenizedPool = normalizedPool.map((value) => tokenize(value));

    return terms.some((term) => {
      const variants = [term];
      return normalizedPool.some((value, index) =>
        variants.some((variant) => fuzzyContains(value, tokenizedPool[index], variant)),
      );
    });
  }

  function matchRemote(job) {
    const type = job.workplaceType?.toLowerCase?.() ?? "";
    if (type.includes("remote") || type.includes("uzaktan")) {
      return true;
    }

    const location = job.location?.toLowerCase?.() ?? "";
    if (location.includes("remote") || location.includes("uzaktan")) {
      return true;
    }

    const textPool = buildTextPool(job);
    if (REMOTE_NEGATIVE_HINTS.some((hint) => textPool.has(hint))) {
      return false;
    }

    if (REMOTE_POSITIVE_HINTS.some((hint) => textPool.has(hint))) {
      return true;
    }

    return false;
  }

  function matchMaxAge(postedAt, maxAgeDays) {
    if (!maxAgeDays || maxAgeDays <= 0) {
      return true;
    }

    if (!postedAt) {
      return false;
    }

    const timestamp = Date.parse(postedAt);
    if (Number.isNaN(timestamp)) {
      return true;
    }

    const diffDays = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    return diffDays <= maxAgeDays;
  }

  function matchMinSalary(job, minSalary) {
    if (!minSalary || Number.isNaN(Number(minSalary))) {
      return true;
    }

    const floor = Number(minSalary);
    if (job.salaryMin && job.salaryMin >= floor) {
      return true;
    }

    if (job.salaryMax && job.salaryMax >= floor) {
      return true;
    }

    return false;
  }

  function determineWorkplaceType(card) {
    const textSources = new Set();

    const badgeSelectors = [
      "[data-test-result-card__workplace-type]",
      "[data-test-job-card-workplace-type]",
      ".job-card-container__metadata-item",
      ".job-card-container__metadata span",
      ".job-card-container__badge-text",
      ".job-card__workplace-type",
      ".job-search-card__workplace-type",
      ".base-search-card__metadata span",
      ".job-card__metadata span",
    ];

    badgeSelectors.forEach((selector) => {
      card.querySelectorAll(selector).forEach((element) => {
        const value = element.textContent?.trim();
        if (value) {
          textSources.add(value.toLowerCase());
        }
      });
    });

    const joinedText = card.textContent?.toLowerCase?.() ?? "";
    if (joinedText) {
      textSources.add(joinedText);
    }

    if (hasRemoteIndicator(textSources)) {
      return "Remote";
    }

    if (hasHybridIndicator(textSources)) {
      return "Hybrid";
    }

    if (hasOnsiteIndicator(textSources)) {
      return "On-site";
    }

    return "";
  }

  function hasRemoteIndicator(texts) {
    for (const text of texts) {
      if (text.includes("remote") || text.includes("uzaktan")) {
        return true;
      }
    }
    return false;
  }

  function hasHybridIndicator(texts) {
    for (const text of texts) {
      if (text.includes("hybrid") || text.includes("hibrit")) {
        return true;
      }
    }
    return false;
  }

  function hasOnsiteIndicator(texts) {
    for (const text of texts) {
      if (text.includes("on-site") || text.includes("ofis")) {
        return true;
      }
    }
    return false;
  }

  function determineExperienceLevel(card) {
    const selectors = [
      "span.job-card-container__metadata-item",
      "span.job-card-list__experience-level",
      "li.job-card-container__metadata-item",
      ".job-search-card__experience",
      ".base-search-card__metadata span",
    ];

    for (const selector of selectors) {
      const element = card.querySelector(selector);
      const value = element?.textContent?.trim();
      if (value && isExperienceKeyword(value)) {
        return normalizeWhitespace(value);
      }
    }

    const summary = card.textContent ?? "";
    const experienceMatch = summary.match(/(entry|junior|mid|senior|director|manager)/i);
    if (experienceMatch) {
      return capitalize(experienceMatch[0]);
    }

    return "";
  }

  function determineIndustries(card) {
    const selectors = [
      "ul.job-card-container__metadata",
      "div.job-card-container__metadata",
      "div.job-card-list__insight",
      "div.base-search-card__metadata",
    ];

    const industries = new Set();

    selectors.forEach((selector) => {
      card.querySelectorAll(`${selector} span, ${selector} li`).forEach((node) => {
        const value = node.textContent?.trim();
        if (value && isIndustryHint(value)) {
          industries.add(normalizeWhitespace(value));
        }
      });
    });

    return Array.from(industries);
  }

  function determineSalary(card) {
    const selectors = [
      "span.job-card-container__salary-info",
      "div.job-card-container__salary-info",
      "span.job-card-container__metadata-item",
      ".job-search-card__salary-info",
      ".base-search-card__salary",
    ];

    for (const selector of selectors) {
      const node = card.querySelector(selector);
      const text = node?.textContent?.trim();
      if (text && hasSalaryIndicator(text)) {
        return parseSalary(text);
      }
    }

    const rawText = card.textContent ?? "";
    if (hasSalaryIndicator(rawText)) {
      return parseSalary(rawText);
    }

    return { salaryMin: null, salaryMax: null, salaryText: "" };
  }

  function isExperienceKeyword(value) {
    const normalized = value.toLowerCase();
    return [
      "entry",
      "junior",
      "mid",
      "senior",
      "director",
      "lead",
      "manager",
      "chief",
    ].some((keyword) => normalized.includes(keyword));
  }

  function isIndustryHint(value) {
    const normalized = value.toLowerCase();
    if (normalized.includes("full-time") || normalized.includes("part-time")) {
      return false;
    }
    if (normalized.includes("remote") || normalized.includes("hybrid") || normalized.includes("on-site")) {
      return false;
    }
    return normalized.includes("industry") || normalized.includes("sector") || normalized.includes("technology") || normalized.includes("software") || normalized.includes("finance") || normalized.includes("marketing");
  }

  function hasSalaryIndicator(text) {
    const normalized = text.toLowerCase();
    return normalized.includes("₺") || normalized.includes("$") || normalized.includes("€") || normalized.includes("salary") || /\d+\s*(k|bin)/i.test(normalized);
  }

  function matchAgainstValue(target, filter, variantResolver = defaultVariantResolver) {
    if (!filter) {
      return true;
    }
    const terms = parseFilterList(filter);
    if (terms.length === 0) {
      return true;
    }

    const normalizedTarget = (target ?? "").toLowerCase();
    if (!normalizedTarget) {
      return false;
    }

    const tokens = tokenize(normalizedTarget);

    return terms.some((term) => {
      const variants = variantResolver(term);
      return variants.some((variant) => fuzzyContains(normalizedTarget, tokens, variant));
    });
  }

  function parseFilterList(value) {
    if (!value) {
      return [];
    }
    return value
      .split(",")
      .map((item) => normalizeWhitespace(item).toLowerCase())
      .filter(Boolean);
  }

  function getKeywordVariants(term) {
    const normalized = normalizeWhitespace(term).toLowerCase();
    const synonyms = KEYWORD_SYNONYM_MAP.get(normalized) ?? [];
    return Array.from(new Set([normalized, ...synonyms]));
  }

  function getExperienceVariants(term) {
    const normalized = normalizeWhitespace(term).toLowerCase();
    const synonyms = EXPERIENCE_SYNONYM_MAP.get(normalized) ?? [];
    return Array.from(new Set([normalized, ...synonyms]));
  }

  function defaultVariantResolver(term) {
    return [normalizeWhitespace(term).toLowerCase()];
  }

  function fuzzyContains(text, tokens, needle) {
    const normalizedNeedle = normalizeWhitespace(needle).toLowerCase();
    if (!normalizedNeedle) {
      return false;
    }

    if (text.includes(normalizedNeedle)) {
      return true;
    }

    if (normalizedNeedle.includes(" ")) {
      const needleTokens = tokenize(normalizedNeedle);
      if (needleTokens.length === 0) {
        return false;
      }

      const windows = slidingWindows(tokens, needleTokens.length);
      return windows.some((window) => similarity(window, normalizedNeedle) >= FUZZY_THRESHOLD);
    }

    return tokens.some((token) => similarity(token, normalizedNeedle) >= FUZZY_THRESHOLD);
  }

  function tokenize(text) {
    if (!text) {
      return [];
    }

    return text
      .split(/[^\p{L}\p{N}]+/u)
      .map((token) => token.toLowerCase())
      .filter(Boolean);
  }

  function slidingWindows(tokens, windowSize) {
    const windows = [];
    if (!Array.isArray(tokens) || windowSize <= 0 || tokens.length < windowSize) {
      return windows;
    }

    for (let index = 0; index <= tokens.length - windowSize; index += 1) {
      windows.push(tokens.slice(index, index + windowSize).join(" "));
    }

    return windows;
  }

  function similarity(a, b) {
    if (!a && !b) {
      return 1;
    }
    if (!a || !b) {
      return 0;
    }

    const distance = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) {
      return 1;
    }

    return 1 - distance / maxLen;
  }

  function levenshtein(a, b) {
    if (a === b) {
      return 0;
    }

    const aLength = a.length;
    const bLength = b.length;

    if (aLength === 0) {
      return bLength;
    }
    if (bLength === 0) {
      return aLength;
    }

    const matrix = Array.from({ length: bLength + 1 }, () => new Array(aLength + 1).fill(0));

    for (let i = 0; i <= bLength; i += 1) {
      matrix[i][0] = i;
    }
    for (let j = 0; j <= aLength; j += 1) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= bLength; i += 1) {
      for (let j = 1; j <= aLength; j += 1) {
        const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }

    return matrix[bLength][aLength];
  }

  function buildSynonymMap(groups) {
    const map = new Map();

    groups.forEach((group) => {
      const normalizedGroup = group.map((term) => normalizeWhitespace(term).toLowerCase());
      normalizedGroup.forEach((term) => {
        map.set(
          term,
          normalizedGroup.filter((item) => item !== term),
        );
      });
    });

    return map;
  }

  function parseSalary(text) {
    const normalized = normalizeWhitespace(text);
    const rangeMatch = normalized.match(/(?<min>[\d.,]+)\s*(?:-|–|to)\s*(?<max>[\d.,]+)/i);
    const singleMatch = normalized.match(/(?<value>[\d.,]+)\s*(k|bin)?/i);

    let salaryMin = null;
    let salaryMax = null;

    if (rangeMatch?.groups) {
      salaryMin = parseSalaryValue(rangeMatch.groups.min, rangeMatch[0]);
      salaryMax = parseSalaryValue(rangeMatch.groups.max, rangeMatch[0]);
    } else if (singleMatch?.groups?.value) {
      const parsed = parseSalaryValue(singleMatch.groups.value, singleMatch[0]);
      salaryMin = parsed;
      salaryMax = parsed;
    }

    return {
      salaryMin,
      salaryMax,
      salaryText: normalized,
    };
  }

  function parseSalaryValue(value, context) {
    if (!value) {
      return null;
    }

    const cleaned = value.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(/,/g, "");
    let numeric = Number.parseInt(cleaned, 10);

    if (Number.isNaN(numeric)) {
      return null;
    }

    if (/\b(k|bin)\b/i.test(context)) {
      numeric *= 1000;
    }

    return numeric;
  }

  function normalizeWhitespace(value) {
    if (!value || typeof value !== "string") {
      return "";
    }
    return value.replace(/\s+/g, " ").trim();
  }

  function capitalize(value) {
    if (!value) {
      return "";
    }
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  function extractCompanySlugFromUrl(url) {
    if (!url) {
      return "";
    }

    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/company\/([^/?#]+)/i);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    } catch (error) {
      console.debug("Failed to extract company slug", error);
    }

    return "";
  }

  function extractCompanyIdFromUrn(urn) {
    if (!urn || typeof urn !== "string") {
      return "";
    }

    const match = urn.match(/urn:li:(?:organization|company):(?<id>\d+)/i);
    if (match?.groups?.id) {
      return match.groups.id;
    }

    return "";
  }

  window.JobSearchLinkedInScraper = {
    getJobCards,
    extractJob,
    collectJobs,
    detectPageType,
    passesFilters,
  };
})();
