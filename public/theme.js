// Runs before the styles and React to restore the appearance without a light flash.
(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem("balance-familiar-theme");
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {
    /* Storage may be disabled; the system preference still works. */
  }
  const theme =
    preference === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#101916" : "#f2f5f1");
})();
