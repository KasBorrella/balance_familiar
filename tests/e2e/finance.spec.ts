import { test, expect, type Page } from "@playwright/test";
async function clean(page: Page) {
  await page.goto("./#/mas");
  await page
    .getByRole("button", { name: "Empezar con mis datos", exact: true })
    .click();
  await page.getByRole("button", { name: "Eliminar datos y empezar" }).click();
  await expect(
    page.getByText("Modo demostración", { exact: true }),
  ).toHaveCount(0);
}
async function addCategory(page: Page, name: string) {
  await page.goto("./#/planificar?tab=gastos");
  await page.getByRole("button", { name: "Categoría", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function addExpense(
  page: Page,
  name: string,
  amount: string,
  school = false,
) {
  await page.getByRole("button", { name: "Gasto", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Importe (€)", { exact: true }).fill(amount);
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption({ label: "Educación e hijos" });
  await page.getByLabel("Fecha de inicio", { exact: true }).fill("2026-01-01");
  if (school) {
    await page.getByLabel("Frecuencia").selectOption("CUSTOM_MONTHS");
    await page.getByRole("button", { name: "Curso escolar" }).click();
  }
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("educación 205 → 225, julio, recarga, backup y restauración en móvil", async ({
  page,
}) => {
  await clean(page);
  await page.getByLabel("Mes seleccionado").fill("2026-10");
  await addCategory(page, "Educación e hijos");
  await addExpense(page, "Comedor", "130");
  await addExpense(page, "Extraescolares", "75", true);
  await expect(page.getByTestId("subtotal-Educación e hijos")).toHaveText(
    /205,00/,
  );
  await expect(page.getByTestId("fixed-total")).toHaveText(/205,00/);
  await page
    .locator("summary")
    .filter({ hasText: "Educación e hijos" })
    .click();
  await page
    .getByRole("button", { name: "Editar Comedor", exact: true })
    .click();
  await page.getByLabel("Importe (€)", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("subtotal-Educación e hijos")).toHaveText(
    /225,00/,
  );
  await page.getByLabel("Mes seleccionado").fill("2026-07");
  await expect(page.getByTestId("subtotal-Educación e hijos")).toHaveText(
    /150,00/,
  );
  await expect(page.getByText("Sin cargo este mes")).toBeVisible();
  await page.reload();
  await page.getByLabel("Mes seleccionado").fill("2026-10");
  await expect(page.getByTestId("fixed-total")).toHaveText(/225,00/);
  await page.goto("./#/mas");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia" }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page
    .getByRole("button", { name: "Vaciar los datos", exact: true })
    .click();
  await page.getByRole("button", { name: "Eliminar datos y empezar" }).click();
  await page.getByLabel("Restaurar copia JSON").setInputFiles(path!);
  await expect(page.getByRole("dialog")).toContainText(
    "Integridad y relaciones verificadas",
  );
  await page.getByRole("button", { name: "Sustituir y restaurar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("./#/planificar?tab=gastos");
  await page.getByLabel("Mes seleccionado").fill("2026-10");
  await expect(page.getByTestId("fixed-total")).toHaveText(/225,00/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("service worker: editar en modo avión y conservar al reabrir", async ({
  page,
  context,
}) => {
  await clean(page);
  await page.getByLabel("Mes seleccionado").fill("2026-10");
  await addCategory(page, "Educación e hijos");
  await addExpense(page, "Comedor", "130");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel("Mes seleccionado").fill("2026-10");
  await page
    .locator("summary")
    .filter({ hasText: "Educación e hijos" })
    .click();
  await page
    .getByRole("button", { name: "Editar Comedor", exact: true })
    .click();
  await page.getByLabel("Importe (€)", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByTestId("fixed-total")).toHaveText(/150,00/);
  const reopened = await context.newPage();
  await reopened.goto("./#/planificar?tab=gastos");
  await reopened.getByLabel("Mes seleccionado").fill("2026-10");
  await expect(reopened.getByTestId("fixed-total")).toHaveText(/150,00/);
  await context.setOffline(false);
});
test("movimientos, filtros, déficit y captura de la interfaz", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Previsión y gasto real" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("resumen-iphone.png"),
    fullPage: true,
    scale: "css",
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: testInfo.outputPath("resumen-escritorio.png"),
    fullPage: true,
    scale: "css",
  });
  await page.goto("./#/movimientos");
  await page.getByRole("button", { name: "Movimiento", exact: true }).click();
  await page.getByLabel("Importe (€)", { exact: true }).fill("12,34");
  await page.getByLabel("Concepto", { exact: true }).fill("Prueba de compra");
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption({ label: "Alimentación" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Prueba de compra", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Buscar movimientos").fill("Prueba");
  await expect(page.locator(".transaction-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Eliminar Prueba de compra", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Eliminar", exact: true })
    .click();
  await expect(page.locator(".transaction-row")).toHaveCount(0);
  await page.goto("./#/planificar");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Objetivo de ahorro del mes (€)").fill("9999");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Déficit" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("fondos y ahorro: aportaciones reales y pago único de un gasto", async ({
  page,
}) => {
  await page.goto("./#/ahorro");
  await page.getByRole("button", { name: "Fondo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Reserva de prueba");
  await page.getByLabel("Importe que necesitas (€)").fill("100");
  await page.getByLabel("Reserva mensual prevista (€)").fill("100");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const fundCard = page.locator("section.card").filter({
    has: page.getByRole("heading", {
      name: "Reserva de prueba",
      exact: true,
    }),
  });
  await fundCard.getByRole("button", { name: "Aportar o retirar" }).click();
  await page.getByLabel("Importe (€)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(fundCard.locator(".fund-amount")).toContainText("100,00");
  await page
    .getByRole("button", { name: "Nuevo movimiento", exact: true })
    .last()
    .click();
  await page.getByLabel("Importe (€)", { exact: true }).fill("100");
  await page
    .getByLabel("Concepto", { exact: true })
    .fill("Pago de seguro de prueba");
  await page
    .getByLabel("Categoría", { exact: true })
    .selectOption({ label: "Seguros" });
  await page
    .getByLabel("Usar dinero de un fondo", { exact: false })
    .selectOption({ label: "Reserva de prueba" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(fundCard.locator(".fund-amount")).toHaveText(/0,00.*de 100,00/);
  await page.getByRole("button", { name: "Objetivo", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Ahorro de prueba");
  await page.getByLabel("Importe objetivo (€)").fill("1000");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  const goalCard = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Ahorro de prueba", exact: true }),
  });
  await goalCard.getByRole("button", { name: "Registrar aportación" }).click();
  await page.getByLabel("Importe (€)", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(goalCard.locator(".fund-amount")).toContainText("50,00");
  await page.goto("./#/movimientos");
  await page.getByLabel("Buscar movimientos").fill("Pago de seguro de prueba");
  await expect(page.locator(".transaction-row")).toHaveCount(1);
});
