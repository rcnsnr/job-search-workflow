// tests/filters.test.js
// Unit tests for filter logic functions

describe("Filter Logic Tests", () => {
  // Helper functions extracted from content/jobs.js for testing
  const normalizeWhitespace = (text) => {
    if (!text || typeof text !== "string") {
      return "";
    }
    return text.replace(/\s+/g, " ").trim();
  };

  const tokenize = (text) => {
    if (!text || typeof text !== "string") {
      return [];
    }
    return text
      .toLowerCase()
      .split(/[\s,;:.!?()[\]{}"'`\-_/\\|@#$%^&*+=<>~]+/)
      .filter((token) => token.length > 0);
  };

  const levenshteinDistance = (a, b) => {
    if (!a || !b) {
      return Math.max(a?.length ?? 0, b?.length ?? 0);
    }

    const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[a.length][b.length];
  };

  const fuzzyMatch = (source, target, threshold = 0.8) => {
    if (!source || !target) {
      return false;
    }

    const s = source.toLowerCase();
    const t = target.toLowerCase();

    if (s === t) {
      return true;
    }

    if (s.includes(t) || t.includes(s)) {
      return true;
    }

    const distance = levenshteinDistance(s, t);
    const maxLength = Math.max(s.length, t.length);
    const similarity = 1 - distance / maxLength;

    return similarity >= threshold;
  };

  const parseSalary = (salaryText) => {
    if (!salaryText || typeof salaryText !== "string") {
      return null;
    }

    const normalized = salaryText.replace(/[^\d.,kKmM\s-]/g, "").trim();
    const matches = normalized.match(/[\d.,]+[kKmM]?/g);

    if (!matches || matches.length === 0) {
      return null;
    }

    const parseValue = (str) => {
      let value = parseFloat(str.replace(/,/g, ""));
      if (str.toLowerCase().includes("k")) {
        value *= 1000;
      } else if (str.toLowerCase().includes("m")) {
        value *= 1000000;
      }
      return value;
    };

    const values = matches.map(parseValue).filter((v) => !isNaN(v));
    if (values.length === 0) {
      return null;
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  const matchMinSalary = (salaryText, minSalary) => {
    if (!minSalary || minSalary <= 0) {
      return true;
    }

    const parsed = parseSalary(salaryText);
    if (!parsed) {
      return true; // Skip if no salary info
    }

    return parsed.max >= minSalary;
  };

  const matchRemoteOnly = (workplaceType, remoteOnly) => {
    if (!remoteOnly) {
      return true;
    }

    if (!workplaceType) {
      return false;
    }

    const normalized = workplaceType.toLowerCase();
    return normalized.includes("remote");
  };

  const matchJobAge = (listedAt, maxAgeDays) => {
    if (!maxAgeDays || maxAgeDays <= 0) {
      return true;
    }

    if (!listedAt) {
      return true;
    }

    const now = Date.now();
    const listedDate = new Date(listedAt).getTime();
    if (isNaN(listedDate)) {
      return true;
    }

    const ageDays = (now - listedDate) / (1000 * 60 * 60 * 24);
    return ageDays <= maxAgeDays;
  };

  // Test suites
  describe("normalizeWhitespace", () => {
    test("should normalize multiple spaces", () => {
      expect(normalizeWhitespace("hello   world")).toBe("hello world");
    });

    test("should trim leading and trailing spaces", () => {
      expect(normalizeWhitespace("  hello world  ")).toBe("hello world");
    });

    test("should handle empty string", () => {
      expect(normalizeWhitespace("")).toBe("");
    });

    test("should handle null/undefined", () => {
      expect(normalizeWhitespace(null)).toBe("");
      expect(normalizeWhitespace(undefined)).toBe("");
    });

    test("should normalize tabs and newlines", () => {
      expect(normalizeWhitespace("hello\t\nworld")).toBe("hello world");
    });
  });

  describe("tokenize", () => {
    test("should split text into tokens", () => {
      expect(tokenize("Hello World")).toEqual(["hello", "world"]);
    });

    test("should handle punctuation", () => {
      expect(tokenize("hello, world! test.")).toEqual(["hello", "world", "test"]);
    });

    test("should handle special characters", () => {
      expect(tokenize("react-native/redux")).toEqual(["react", "native", "redux"]);
    });

    test("should handle empty string", () => {
      expect(tokenize("")).toEqual([]);
    });

    test("should handle null/undefined", () => {
      expect(tokenize(null)).toEqual([]);
      expect(tokenize(undefined)).toEqual([]);
    });
  });

  describe("levenshteinDistance", () => {
    test("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    test("should calculate distance for single character difference", () => {
      expect(levenshteinDistance("hello", "hallo")).toBe(1);
    });

    test("should calculate distance for different length strings", () => {
      expect(levenshteinDistance("hello", "helloworld")).toBe(5);
    });

    test("should handle empty strings", () => {
      expect(levenshteinDistance("", "hello")).toBe(5);
      expect(levenshteinDistance("hello", "")).toBe(5);
    });

    test("should handle null/undefined", () => {
      expect(levenshteinDistance(null, "hello")).toBe(5);
      expect(levenshteinDistance("hello", null)).toBe(5);
    });
  });

  describe("fuzzyMatch", () => {
    test("should match identical strings", () => {
      expect(fuzzyMatch("developer", "developer")).toBe(true);
    });

    test("should match case-insensitively", () => {
      expect(fuzzyMatch("Developer", "developer")).toBe(true);
    });

    test("should match substrings", () => {
      expect(fuzzyMatch("senior developer", "developer")).toBe(true);
    });

    test("should match similar strings with typos", () => {
      expect(fuzzyMatch("developr", "developer", 0.7)).toBe(true);
    });

    test("should not match very different strings", () => {
      expect(fuzzyMatch("developer", "manager")).toBe(false);
    });

    test("should handle null/undefined", () => {
      expect(fuzzyMatch(null, "test")).toBe(false);
      expect(fuzzyMatch("test", null)).toBe(false);
    });
  });

  describe("parseSalary", () => {
    test("should parse simple salary", () => {
      const result = parseSalary("$50000");
      expect(result).toEqual({ min: 50000, max: 50000 });
    });

    test("should parse salary range", () => {
      const result = parseSalary("$50,000 - $80,000");
      expect(result).toEqual({ min: 50000, max: 80000 });
    });

    test("should parse K notation", () => {
      const result = parseSalary("50K - 80K");
      expect(result).toEqual({ min: 50000, max: 80000 });
    });

    test("should handle empty/null input", () => {
      expect(parseSalary("")).toBe(null);
      expect(parseSalary(null)).toBe(null);
    });

    test("should handle non-salary text", () => {
      expect(parseSalary("No salary info")).toBe(null);
    });
  });

  describe("matchMinSalary", () => {
    test("should pass when salary meets minimum", () => {
      expect(matchMinSalary("$60,000 - $80,000", 50000)).toBe(true);
    });

    test("should fail when salary below minimum", () => {
      expect(matchMinSalary("$30,000 - $40,000", 50000)).toBe(false);
    });

    test("should pass when no minimum specified", () => {
      expect(matchMinSalary("$30,000", 0)).toBe(true);
      expect(matchMinSalary("$30,000", null)).toBe(true);
    });

    test("should pass when no salary info available", () => {
      expect(matchMinSalary("", 50000)).toBe(true);
      expect(matchMinSalary(null, 50000)).toBe(true);
    });
  });

  describe("matchRemoteOnly", () => {
    test("should match remote positions when filter enabled", () => {
      expect(matchRemoteOnly("Remote", true)).toBe(true);
      expect(matchRemoteOnly("Fully remote", true)).toBe(true);
    });

    test("should not match on-site when filter enabled", () => {
      expect(matchRemoteOnly("On-site", true)).toBe(false);
      expect(matchRemoteOnly("Hybrid", true)).toBe(false);
    });

    test("should pass all when filter disabled", () => {
      expect(matchRemoteOnly("On-site", false)).toBe(true);
      expect(matchRemoteOnly("Remote", false)).toBe(true);
    });

    test("should handle null workplace type", () => {
      expect(matchRemoteOnly(null, true)).toBe(false);
      expect(matchRemoteOnly(null, false)).toBe(true);
    });
  });

  describe("matchJobAge", () => {
    test("should pass recent jobs", () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      expect(matchJobAge(yesterday, 7)).toBe(true);
    });

    test("should fail old jobs", () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      expect(matchJobAge(twoWeeksAgo, 7)).toBe(false);
    });

    test("should pass when no max age specified", () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(matchJobAge(oldDate, 0)).toBe(true);
      expect(matchJobAge(oldDate, null)).toBe(true);
    });

    test("should pass when no listed date", () => {
      expect(matchJobAge(null, 7)).toBe(true);
      expect(matchJobAge("", 7)).toBe(true);
    });
  });
});

describe("Keyword Validation Tests", () => {
  const MAX_KEYWORD_ITEMS = 50;

  const normalizeKeywordValue = (value) => {
    if (!value || typeof value !== "string") {
      return "";
    }
    return value.trim().replace(/\s+/g, " ");
  };

  const sanitizeKeywordList = (list) => {
    if (!Array.isArray(list)) {
      return { items: [], truncated: false };
    }

    const uniqueItems = [];
    const seen = new Set();

    for (const item of list) {
      const normalized = normalizeKeywordValue(item);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(normalized);
      }

      if (uniqueItems.length >= MAX_KEYWORD_ITEMS) {
        break;
      }
    }

    return {
      items: uniqueItems,
      truncated: list.length > uniqueItems.length,
    };
  };

  describe("normalizeKeywordValue", () => {
    test("should trim whitespace", () => {
      expect(normalizeKeywordValue("  hello  ")).toBe("hello");
    });

    test("should normalize internal whitespace", () => {
      expect(normalizeKeywordValue("hello   world")).toBe("hello world");
    });

    test("should handle empty/null", () => {
      expect(normalizeKeywordValue("")).toBe("");
      expect(normalizeKeywordValue(null)).toBe("");
    });
  });

  describe("sanitizeKeywordList", () => {
    test("should remove duplicates", () => {
      const result = sanitizeKeywordList(["react", "React", "REACT"]);
      expect(result.items).toEqual(["react"]);
      // truncated: true because items were removed from the original list (duplicates)
      expect(result.truncated).toBe(true);
    });

    test("should remove empty items", () => {
      const result = sanitizeKeywordList(["react", "", "  ", "vue"]);
      expect(result.items).toEqual(["react", "vue"]);
    });

    test("should truncate at max items", () => {
      const longList = Array.from({ length: 60 }, (_, i) => `keyword${i}`);
      const result = sanitizeKeywordList(longList);
      expect(result.items.length).toBe(50);
      expect(result.truncated).toBe(true);
    });

    test("should handle non-array input", () => {
      expect(sanitizeKeywordList(null)).toEqual({ items: [], truncated: false });
      expect(sanitizeKeywordList("string")).toEqual({ items: [], truncated: false });
    });
  });
});

describe("isExpired Tests", () => {
  const isExpired = (expiresAt) => {
    if (!expiresAt) {
      return true;
    }

    const timestamp = typeof expiresAt === "number" ? expiresAt : Date.parse(expiresAt);
    if (Number.isNaN(timestamp)) {
      return true;
    }

    return Date.now() > timestamp;
  };

  test("should return true for null/undefined", () => {
    expect(isExpired(null)).toBe(true);
    expect(isExpired(undefined)).toBe(true);
  });

  test("should return true for past timestamps", () => {
    const pastDate = Date.now() - 1000;
    expect(isExpired(pastDate)).toBe(true);
  });

  test("should return false for future timestamps", () => {
    const futureDate = Date.now() + 60000;
    expect(isExpired(futureDate)).toBe(false);
  });

  test("should handle ISO date strings", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const futureDate = new Date(Date.now() + 60000).toISOString();
    expect(isExpired(pastDate)).toBe(true);
    expect(isExpired(futureDate)).toBe(false);
  });

  test("should return true for invalid date strings", () => {
    expect(isExpired("invalid-date")).toBe(true);
  });
});
