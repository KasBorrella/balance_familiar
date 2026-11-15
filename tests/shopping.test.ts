import { beforeEach, afterEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { emptyData, metadata } from "../src/domain/models";
import {
  choosePackages,
  latestPrice,
  prepareShopping,
  priceIsStale,
} from "../src/domain/shopping";
import { today } from "../src/domain/calendar";
import { addDays } from "../src/domain/meals";
import {
  parseCatalog,
  validateCatalog,
  catalogFields,
  type CatalogRow,
} from "../src/integrations/catalog";
import { createDatabase, storesV1, type FinanceDB } from "../src/db/database";
import { DexieFinanceRepository } from "../src/db/repository";
import {
  addExtra,
  confirmPurchase,
  consumeList,
  createShoppingList,
  saveCatalogRows,
  consumePantry,
} from "../src/features/shopping/service";
import {
  checksum,
  exportBackup,
  restoreBackup,
  validateBackup,
} from "../src/features/backup/service";
import { shoppingTables } from "../src/domain/shopping-models";

const catalogRow = (sku = "arroz-500"): CatalogRow => ({
  sku,
  name: "Arroz",
  packageQuantity: 500,
  unit: "g",
  group: "food",
  priceCents: 150,
  observedAt: today(),
  sourceReference: "Prueba ficticia",
  storeContext: "Tienda de prueba",
  variableWeight: false,
  allergens: [],
  labelChecked: true,
});
function fixture() {
  const data = emptyData(),
    date = today();
  data.householdMembers.push({
    ...metadata(),
    alias: "Persona",
    type: "adult",
    portionsFactor: 1,
    active: true,
    restrictions: [],
    preferences: [],
    mealsAtHome: ["lunch"],
  });
  const ingredient = {
    ...metadata(),
    name: "Arroz crudo",
    baseUnit: "g" as const,
    allergens: [],
  };
  data.ingredients.push(ingredient);
  const recipe = {
    ...metadata(),
    name: "Arroz",
    servings: 1,
    mealType: ["lunch" as const],
    minutes: 15,
    method: "Cocer",
    instructions: "Cocer",
    substitutions: "",
    foodGroups: [],
    allergens: [],
    maxRepeat: 7,
    estimatedCostCents: null,
    source: "manual" as const,
  };
  data.recipes.push(recipe);
  data.recipeIngredients.push({
    ...metadata(),
    recipeId: recipe.id,
    ingredientId: ingredient.id,
    quantityBase: 400,
  });
  const plan = {
    ...metadata(),
    startDate: date,
    endDate: addDays(date, 6),
    budgetCents: null,
    maxMinutes: 30,
    status: "draft" as const,
  };
  data.mealPlans.push(plan);
  data.mealEntries.push({
    ...metadata(),
    mealPlanId: plan.id,
    date,
    slot: "lunch",
    recipeId: recipe.id,
    servings: 1,
  });
  data.categories.push({
    ...metadata(),
    name: "Supermercado",
    type: "expense",
    parentId: null,
    archivedAt: null,
    sortOrder: 0,
  });
  return data;
}
describe("Importación y envases", () => {
  it("combina formatos por coste y desempata por menor exceso", () => {
    expect(
      choosePackages(900, [
        { id: "500", quantity: 500, cents: 150 },
        { id: "1000", quantity: 1000, cents: 260 },
      ]),
    ).toEqual([{ id: "1000", count: 1 }]);
    const mixed = choosePackages(1100, [
      { id: "500", quantity: 500, cents: 100 },
      { id: "700", quantity: 700, cents: 130 },
    ]);
    expect(
      mixed.reduce((s, p) => s + p.count * (p.id === "500" ? 100 : 130), 0),
    ).toBe(230);
    expect(
      choosePackages(400, [
        { id: "500", quantity: 500, cents: 100 },
        { id: "700", quantity: 700, cents: 100 },
      ]),
    ).toEqual([{ id: "500", count: 1 }]);
  });
  it("coincide con una búsqueda exhaustiva en combinaciones pequeñas", () => {
    for (let required = 1; required <= 30; required++) {
      const options = [
          { id: "a", quantity: 4, cents: 5 },
          { id: "b", quantity: 7, cents: 8 },
        ],
        picked = choosePackages(required, options);
      const actual = picked.reduce(
        (s, p) => s + options.find((o) => o.id === p.id)!.cents * p.count,
        0,
      );
      let expected = Infinity;
      for (let a = 0; a < 12; a++)
        for (let b = 0; b < 12; b++)
          if (a * 4 + b * 7 >= required)
            expected = Math.min(expected, a * 5 + b * 8);
      expect(actual).toBe(expected);
    }
  });
  it("lee CSV con BOM, comillas, punto y coma, saltos y columnas relacionadas", () => {
    const input = parseCatalog(
      '\uFEFFreferencia;nombre;cantidad;unidad;precio;fecha;fuente;zona\r\nA;"Arroz; especial\nseco";500;g;150;2026-01-01;Etiqueta;Madrid\r\n',
      "csv",
    );
    const mapping = {
      sku: "referencia",
      name: "nombre",
      packageQuantity: "cantidad",
      unit: "unidad",
      priceCents: "precio",
      observedAt: "fecha",
      sourceReference: "fuente",
      storeContext: "zona",
    };
    const result = validateCatalog(input, mapping, today());
    expect(result.errors).toEqual([]);
    expect(result.rows[0].name).toContain("\n");
    expect(() => parseCatalog('a;b\n"mal;dato', "csv")).toThrow("comillas");
  });
  it("rechaza importes decimales en céntimos, duplicados y fechas futuras", () => {
    const row = catalogRow();
    const input = parseCatalog(
      JSON.stringify([
        row,
        { ...row, priceCents: 1.5 },
        { ...row, observedAt: addDays(today(), 1) },
      ]),
      "json",
    );
    const result = validateCatalog(
      input,
      Object.fromEntries(catalogFields.map((k) => [k, k])),
      today(),
    );
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
let db: FinanceDB, repo: DexieFinanceRepository;
beforeEach(() => {
  db = createDatabase(`shopping-${crypto.randomUUID()}`);
  repo = new DexieFinanceRepository(db);
});
afterEach(async () => {
  await db.delete();
});
async function seed() {
  const f = fixture();
  await repo.mutate((data) => Object.assign(data, f));
  await saveCatalogRows([catalogRow()], "manual", "Prueba", repo);
  const data = await repo.snapshot();
  await repo.save("ingredientProductMappings", {
    ...metadata(),
    ingredientId: data.ingredients[0].id,
    productId: data.products[0].id,
    usableQuantity: 500,
  });
  return await repo.snapshot();
}
describe("Compra y despensa atómicas", () => {
  it("reserva solo lotes vigentes y evita comprar dos veces para la misma comida", async () => {
    let data = await seed();
    const ingredientId = data.ingredients[0].id;
    await repo.save("pantryLots", {
      ...metadata(),
      ingredientId,
      productId: null,
      purchaseId: null,
      quantityBase: 100,
      expiryDate: addDays(today(), 8),
      note: "",
    });
    await repo.save("pantryLots", {
      ...metadata(),
      ingredientId,
      productId: null,
      purchaseId: null,
      quantityBase: 900,
      expiryDate: addDays(today(), -1),
      note: "",
    });
    const id = await createShoppingList(
      data.mealPlans[0].id,
      today(),
      null,
      false,
      repo,
    );
    data = await repo.snapshot();
    expect(data.shoppingLists[0].reservations[0].quantityBase).toBe(100);
    expect(data.shoppingItems[0].packagesCount).toBe(1);
    await expect(
      createShoppingList(data.mealPlans[0].id, today(), null, false, repo),
    ).rejects.toThrow("Ya hay una lista");
    await expect(
      consumePantry(data.shoppingLists[0].reservations[0].lotId, 1, repo),
    ).rejects.toThrow("libre");
    await repo.remove("shoppingLists", id);
    expect((await repo.snapshot()).shoppingItems).toEqual([]);
  });
  it("avisa de precios antiguos y excluye los ficticios y alérgenos", async () => {
    const data = await seed(),
      p = data.priceObservations[0];
    p.observedAt = addDays(today(), -15);
    expect(priceIsStale(data, p)).toBe(true);
    p.sourceType = "demo";
    p.verificationStatus = "demo";
    expect(latestPrice(data, p.productId)).toBeUndefined();
    expect(
      prepareShopping(
        data,
        data.mealPlans[0].id,
        data.supermarkets[0].id,
        today(),
        null,
      ).list.warnings,
    ).toHaveLength(1);
    p.sourceType = "manual";
    p.verificationStatus = "user_checked";
    data.householdMembers[0].restrictions = ["gluten"];
    data.products[0].allergens = ["gluten"];
    expect(
      prepareShopping(
        data,
        data.mealPlans[0].id,
        data.supermarkets[0].id,
        today(),
        null,
      ).items,
    ).toEqual([]);
  });
  it("registra un ticket, separa grupos y conserva sobrantes tras un único consumo", async () => {
    let data = await seed();
    await saveCatalogRows(
      [{ ...catalogRow("jabon"), name: "Jabón", group: "hygiene", unit: "ml" }],
      "manual",
      "Prueba",
      repo,
    );
    const id = await createShoppingList(
      data.mealPlans[0].id,
      today(),
      500,
      false,
      repo,
    );
    data = await repo.snapshot();
    await addExtra(
      id,
      data.products.find((p) => p.externalSku === "jabon")!.id,
      1,
      repo,
    );
    data = await repo.snapshot();
    const lines = data.shoppingItems.map((i) => ({
      shoppingItemId: i.id,
      packagesCount: 1,
      quantityBase: 500,
      totalCents: 160,
      expiryDate: null,
    }));
    await confirmPurchase(
      id,
      today(),
      lines,
      { food: data.categories[0].id, hygiene: data.categories[0].id },
      "Ticket de prueba",
      repo,
    );
    data = await repo.snapshot();
    expect(data.purchases[0].actualTotalCents).toBe(320);
    expect(data.transactions).toHaveLength(2);
    expect(data.pantryLots).toHaveLength(1);
    await expect(
      confirmPurchase(id, today(), lines, {}, "", repo),
    ).rejects.toThrow("ya está");
    await consumeList(id, repo);
    data = await repo.snapshot();
    expect(data.pantryLots[0].quantityBase).toBe(100);
    await expect(consumeList(id, repo)).rejects.toThrow("una vez");
    await expect(
      repo.remove("transactions", data.transactions[0].id),
    ).rejects.toThrow("ticket");
    const backup = await exportBackup(db);
    await repo.startFresh();
    await restoreBackup(backup, db);
    expect(await repo.snapshot()).toEqual(data);
  });
  it("revierte ticket inválido y consumo con cantidades insuficientes", async () => {
    let data = await seed();
    const id = await createShoppingList(
      data.mealPlans[0].id,
      today(),
      null,
      false,
      repo,
    );
    data = await repo.snapshot();
    const lines = [
      {
        shoppingItemId: data.shoppingItems[0].id,
        packagesCount: 1,
        quantityBase: 200,
        totalCents: 150,
        expiryDate: null,
      },
    ];
    await expect(
      confirmPurchase(id, today(), lines, {}, "", repo),
    ).rejects.toThrow("categoría");
    expect(await repo.snapshot()).toEqual(data);
    await confirmPurchase(
      id,
      today(),
      lines,
      { food: data.categories[0].id },
      "",
      repo,
    );
    const before = await repo.snapshot();
    await expect(consumeList(id, repo)).rejects.toThrow("Falta cantidad");
    expect(await repo.snapshot()).toEqual(before);
  });
  it("importa de forma atómica, conserva precios y bloquea reimportaciones idénticas", async () => {
    await seed();
    const before = await repo.snapshot();
    await expect(
      saveCatalogRows(
        [catalogRow("nuevo"), { ...catalogRow(), unit: "ml" }],
        "import",
        "archivo",
        repo,
      ),
    ).rejects.toThrow("formato");
    expect(await repo.snapshot()).toEqual(before);
    await saveCatalogRows(
      [{ ...catalogRow(), priceCents: 180 }],
      "import",
      "archivo",
      repo,
    );
    expect((await repo.snapshot()).priceObservations).toHaveLength(2);
    await expect(
      saveCatalogRows(
        [{ ...catalogRow(), priceCents: 180 }],
        "import",
        "archivo",
        repo,
      ),
    ).rejects.toThrow("ya se ha importado");
  });
  it("migra copias v3 verificadas y bases v3 sin alterar recetas", async () => {
    const data = fixture();
    const oldData = Object.fromEntries(
      Object.entries(data).filter(([key]) => !(key in shoppingTables)),
    );
    const payload = {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      appVersion: "1.1.0",
      data: oldData,
    };
    const result = await validateBackup({
      ...payload,
      checksum: await checksum(payload),
    });
    expect(result.data).toEqual(data);
    expect(result.schemaVersion).toBe(4);
    const name = `legacy3-${crypto.randomUUID()}`,
      old = new Dexie(name);
    old
      .version(3)
      .stores({
        ...storesV1,
        householdMembers: "&id",
        ingredients: "&id",
        recipes: "&id",
        recipeIngredients: "&id",
        mealPlans: "&id",
        mealEntries: "&id",
      });
    await old.table("recipes").put(data.recipes[0]);
    old.close();
    const migrated = createDatabase(name);
    try {
      expect(
        (await new DexieFinanceRepository(migrated).snapshot()).recipes,
      ).toEqual(data.recipes);
      expect(migrated.verno).toBe(4);
    } finally {
      await migrated.delete();
    }
  });
});
