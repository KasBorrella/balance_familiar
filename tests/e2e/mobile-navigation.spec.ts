import { test, expect } from "@playwright/test";

test("la barra inferior permanece visible mientras el contenido se desplaza", async ({
  page,
}) => {
  await page.goto("./#/");
  const nav = page.getByRole("navigation", { name: "Navegación móvil" });
  const content = page.locator(".main-shell");
  await expect(nav).toBeVisible();
  for (const height of [844, 680, 900]) {
    await page.setViewportSize({ width: 390, height });
    for (const scroll of [0, 600, 100000, 200, 0]) {
      await content.evaluate(
        (element, top) => element.scrollTo(0, top),
        scroll,
      );
      if (scroll > 0)
        await expect
          .poll(() => content.evaluate((e) => e.scrollTop))
          .toBeGreaterThan(0);
      await expect
        .poll(async () => {
          const rect = await nav.boundingBox();
          return rect ? Math.abs(rect.y + rect.height - height) : Infinity;
        })
        .toBeLessThanOrEqual(1);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(
        nav.getByRole("link", { name: "Menús", exact: true }),
      ).toBeInViewport();
    }
  }
  await content.evaluate((e) => e.scrollTo(0, 100000));
  await nav.getByRole("link", { name: "Más", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await expect.poll(() => content.evaluate((e) => e.scrollTop)).toBe(0);
  await content.evaluate((e) => e.scrollTo(0, 500));
  await page
    .getByRole("button", { name: "Nuevo movimiento", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(nav).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(nav).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
});
