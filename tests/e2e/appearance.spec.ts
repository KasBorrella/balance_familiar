import { test, expect } from "@playwright/test";

test("el tema sigue al dispositivo o conserva la elección manual, también sin conexión", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./#/mas");
  await expect(
    page.getByRole("heading", { name: "Apariencia", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Según el dispositivo", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Claro", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Según el dispositivo", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  const secondPage = await context.newPage();
  await secondPage.goto("./");
  await expect(
    secondPage.getByRole("heading", { name: "Resumen del mes" }),
  ).toBeVisible();
  await expect(secondPage.locator("html")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(secondPage.locator("html")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(secondPage.locator("html")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await secondPage.close();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Apariencia", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Nuevo movimiento", exact: true })
    .last()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("background-color", "rgb(26, 39, 34)");
  await expect(page.getByLabel("Concepto", { exact: true })).toHaveCSS(
    "background-color",
    "rgb(26, 39, 34)",
  );
  await page.getByLabel("Importe (€)", { exact: true }).fill("4,50");
  await page.getByLabel("Concepto", { exact: true }).fill("Panadería");
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption({ label: "Alimentación" });
  await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("./#/movimientos");
  await expect(page.getByText("Panadería", { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("diseño claro y oscuro en móvil y escritorio, sin desbordamientos", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: "Previsión y gasto real" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.screenshot({
      path: testInfo.outputPath(`resumen-${theme}-escritorio.png`),
      fullPage: true,
      scale: "css",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: testInfo.outputPath(`resumen-${theme}-movil.png`),
      fullPage: true,
      scale: "css",
    });
    for (const route of ["planificar", "movimientos", "ahorro", "mas"]) {
      await page.goto(`./#/${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} en ${theme}`,
      ).toBe(true);
    }
    await page.screenshot({
      path: testInfo.outputPath(`ajustes-${theme}-movil.png`),
      fullPage: true,
      scale: "css",
    });
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Resumen del mes" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
