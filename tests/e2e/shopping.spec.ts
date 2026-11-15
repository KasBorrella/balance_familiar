import { test, expect } from "@playwright/test";

test("catálogo, equivalencia, compra, consumo y copias funcionan en móvil sin conexión", async ({
  page,
  context,
}) => {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
  }).format(new Date());
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
  await page.getByLabel("Raciones de la receta").fill("1");
  await page.getByLabel("Cantidad 1", { exact: true }).fill("400");
  await page.getByLabel("Pasos", { exact: true }).fill("Cocer el arroz.");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Crear menú", exact: true }).click();
  await page.getByLabel("Primer día", { exact: true }).fill(date);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("tab", { name: "Calendario", exact: true }).click();
  await page
    .getByRole("button", { name: `Elegir comida del ${date}`, exact: true })
    .click();
  await page
    .getByLabel("Receta", { exact: true })
    .selectOption({ label: "Arroz de casa" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("link", { name: "Lista de compra y despensa" }).click();
  await page.getByRole("tab", { name: "Catálogo", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV o JSON" }).click();
  const headers =
    "sku;name;packageQuantity;unit;group;priceCents;observedAt;sourceReference;storeContext;labelChecked";
  const row = `AR500;Arroz de prueba;500;g;food;150;${date};Prueba ficticia;Tienda de prueba;true`;
  await page.getByLabel("Archivo de catálogo").setInputFiles({
    name: "productos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`${headers}\n${row}\n${row}`),
  });
  await expect(
    page.getByRole("button", { name: "Confirmar importación" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("repetida");
  await page.getByLabel("Archivo de catálogo").setInputFiles({
    name: "productos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`${headers}\n${row}`),
  });
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Vincular ingrediente", exact: true })
    .click();
  await page
    .getByLabel("Ingrediente equivalente", { exact: true })
    .selectOption({ label: "Arroz crudo" });
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("tab", { name: "Despensa", exact: true }).click();
  await page.getByRole("button", { name: "Añadir lote", exact: true }).click();
  await page
    .getByLabel("Ingrediente del lote", { exact: true })
    .selectOption({ label: "Arroz crudo (g)" });
  await page.getByLabel("Cantidad que queda", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("tab", { name: "Lista", exact: true }).click();
  await page
    .getByRole("button", { name: "Preparar lista", exact: true })
    .click();
  await page.getByLabel("Límite para esta lista (€)").fill("1,70");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1 envases ×", { exact: false })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Registrar ticket", exact: true })
    .click();
  await page.getByLabel("Importe de Arroz de prueba (€)").fill("1,80");
  await page
    .getByLabel("Categoría de gasto: Alimentación", { exact: true })
    .selectOption({ label: "Alimentación" });
  await page
    .getByRole("button", { name: "Confirmar compra y registrar gasto" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("supera el límite");
  await page
    .getByRole("button", { name: "Anotar consumo del menú", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar consumo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("El consumo ya está descontado de la despensa."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Despensa", exact: true }).click();
  await expect
    .poll(async () => {
      const lots = await page.locator(".meal-record strong").allTextContents();
      return lots.reduce(
        (total, text) => total + Number(text.match(/· (\d+) g/)?.[1] ?? 0),
        0,
      );
    })
    .toBe(200);
  await page.goto("./#/movimientos");
  await expect(
    page.getByText("Compra Mercadona · alimentación", { exact: true }),
  ).toHaveCount(1);
  await page.goto("./#/mas");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia" }).click();
  const file = await downloaded;
  await page
    .getByLabel("Restaurar copia JSON")
    .setInputFiles((await file.path())!);
  await page.getByRole("button", { name: "Sustituir y restaurar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("./#/compra?tab=historial");
  await expect(page.locator(".shopping-history")).toHaveCount(1);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
      for (const tab of ["Lista", "Catálogo", "Despensa", "Compras"]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
      }
      await page.getByRole("tab", { name: "Lista", exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/compra-${width}-${colorScheme}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
});
