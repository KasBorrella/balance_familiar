import { test, expect } from "@playwright/test";

test("menú semanal, restricciones, persistencia sin conexión y copia completa", async ({
  page,
  context,
}) => {
  await page.goto("./#/menus");
  await page.getByRole("button", { name: "Cargar ejemplo ficticio" }).click();
  await page.getByRole("button", { name: "Proponer platos" }).click();
  await expect(
    page.getByText("21 comidas añadidas.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".meal-cell strong")).toHaveCount(21);
  await page.getByRole("button", { name: "Proponer platos" }).click();
  await expect(
    page.getByText("0 comidas añadidas.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Familia", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar Adulto de ejemplo 1", exact: true })
    .click();
  await page.getByLabel("gluten", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Calendario", exact: true }).click();
  await expect(page.locator(".meal-conflict").first()).toBeVisible();
  await page
    .locator(".meal-conflict")
    .first()
    .getByRole("button", { name: /Editar/ })
    .click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "gluten",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".meal-cell strong")).toHaveCount(21);
  await page.getByRole("tab", { name: "Familia", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar Adulto de ejemplo 1", exact: true })
    .click();
  await page.getByLabel("Nombre o apodo").fill("Mi persona sin conexión");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Mi persona sin conexión", { exact: true }),
  ).toBeVisible();
  await page.goto("./#/mas");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await page.goto("./#/menus");
  await page
    .getByRole("button", { name: "Empezar mi planificador desde cero" })
    .click();
  await page
    .getByRole("button", { name: "Vaciar planificador", exact: true })
    .click();
  await expect(page.getByText("Vamos a preparar el primer menú")).toBeVisible();
  await page.goto("./#/mas");
  await page.getByLabel("Restaurar copia JSON").setInputFiles(path!);
  await page.getByRole("button", { name: "Sustituir y restaurar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("./#/menus?tab=familia");
  await expect(
    page.getByText("Mi persona sin conexión", { exact: true }),
  ).toBeVisible();
});

test("alta manual de familia, ingredientes, receta y menú mensual en móvil", async ({
  page,
}) => {
  await page.goto("./#/menus?tab=familia");
  await page
    .getByRole("button", { name: "Añadir persona", exact: true })
    .last()
    .click();
  await page.getByLabel("Nombre o apodo").fill("Ana");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Ingredientes", exact: true }).click();
  await page
    .getByRole("button", { name: "Añadir ingrediente", exact: true })
    .click();
  await page.getByLabel("Nombre del ingrediente").fill("Arroz crudo");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("tab", { name: "Recetas", exact: true }).click();
  await page
    .getByRole("button", { name: "Añadir receta", exact: true })
    .click();
  await page.getByLabel("Nombre de la receta").fill("Arroz de casa");
  await page.getByLabel("Coste estimado de toda la receta (€)").fill("2,40");
  await page
    .getByLabel("Pasos", { exact: true })
    .fill("Cocer el arroz con agua.");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Crear menú", exact: true }).click();
  await page.getByLabel("Primer día").fill("2026-12-01");
  await page.getByLabel("Duración", { exact: true }).selectOption("31");
  await page.getByLabel("Límite estimado para este menú (€)").fill("50");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("tab", { name: "Calendario", exact: true }).click();
  await page
    .getByRole("button", { name: "Elegir comida del 2026-12-01", exact: true })
    .click();
  await page
    .getByLabel("Receta", { exact: true })
    .selectOption({ label: "Arroz de casa" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.locator(".meal-cell strong")).toHaveText(["Arroz de casa"]);
  await expect(page.locator(".meal-ingredients-total")).toContainText("25 g");
  await page.getByRole("button", { name: "Todo el menú", exact: true }).click();
  await expect(page.locator(".meal-day")).toHaveCount(31);
  await page.getByRole("button", { name: "Proponer platos" }).click();
  await expect(page.getByText(/huecos siguen pendientes/)).toBeVisible();
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `test-results/menus-${width}-${colorScheme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});
