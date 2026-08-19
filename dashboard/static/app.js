(() => {
  "use strict";

  const root = document.documentElement;
  const themeToggle = document.querySelector(".theme-toggle");
  const themeValue = document.querySelector(".theme-value");

  const applyTheme = (theme) => {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
      themeToggle.setAttribute("aria-label", `Theme: ${nextTheme}. Activate to switch theme.`);
    }
    if (themeValue) {
      themeValue.textContent = nextTheme === "dark" ? "Dark" : "Light";
    }
  };

  applyTheme(root.dataset.theme);
  themeToggle?.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("jsw-theme", nextTheme);
  });

  const menuButton = document.querySelector(".mobile-menu-button");
  const navigation = document.querySelector(".primary-nav");
  menuButton?.addEventListener("click", () => {
    const isOpen = navigation?.classList.toggle("open") ?? false;
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation?.classList.contains("open")) {
      navigation.classList.remove("open");
      menuButton?.setAttribute("aria-expanded", "false");
      menuButton?.focus();
    }
  });

  const searchInput = document.querySelector("#job-search");
  const stageSelect = document.querySelector("#job-stage");
  const resetButton = document.querySelector("#job-filter-reset");
  const jobRows = [...document.querySelectorAll(".job-row")];
  const emptyFilter = document.querySelector("#jobs-empty-filter");

  const filterJobs = () => {
    const query = searchInput?.value.trim().toLocaleLowerCase() ?? "";
    const stage = stageSelect?.value ?? "";
    let visibleCount = 0;

    jobRows.forEach((row) => {
      const matchesQuery = !query || row.dataset.search?.toLocaleLowerCase().includes(query);
      const matchesStage = !stage || row.dataset.stage === stage;
      const visible = Boolean(matchesQuery && matchesStage);
      row.hidden = !visible;
      visibleCount += visible ? 1 : 0;
    });

    if (emptyFilter) {
      emptyFilter.hidden = visibleCount > 0 || jobRows.length === 0;
    }
  };

  searchInput?.addEventListener("input", filterJobs);
  stageSelect?.addEventListener("change", filterJobs);
  resetButton?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (stageSelect) stageSelect.value = "";
    filterJobs();
    searchInput?.focus();
  });
})();
