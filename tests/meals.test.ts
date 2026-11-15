import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { shoppingTables } from "../src/domain/shopping-models";
import { emptyData, metadata } from "../src/domain/models";
import {
  addDays,
  consolidateIngredients,
  entryReasons,
  generateMeals,
  planCost,
  recipeReasons,
} from "../src/domain/meals";
import { validateData } from "../src/domain/validation";
import { addMealDemo } from "../src/features/meal-planning/demo";
import { createDatabase, storesV1 } from "../src/db/database";
import { DexieFinanceRepository } from "../src/db/repository";
import {
  checksum,
  exportBackup,
  restoreBackup,
  validateBackup,
} from "../src/features/backup/service";

function fixture() {
  const data = emptyData();
  addMealDemo(data);
  data.mealPlans[0].startDate = "2026-12-28";
  data.mealPlans[0].endDate = "2027-01-03";
  return data;
}
describe("Planificador de comidas", () => {
  it("genera una semana completa sin reducir raciones y consolida cantidades", () => {
    const data = fixture(),
      plan = data.mealPlans[0];
    const result = generateMeals(data, plan);
    expect(result.gaps).toHaveLength(0);
    expect(result.added).toHaveLength(21);
    expect(result.added.every((e) => e.servings === 2.5)).toBe(true);
    data.mealEntries = result.added;
    expect(() => validateData(data)).not.toThrow();
    expect(
      result.added.every((e) => entryReasons(data, plan, e).length === 0),
    ).toBe(true);
    expect(
      consolidateIngredients(data, result.added).every((i) =>
        Number.isInteger(i.quantity),
      ),
    ).toBe(true);
  });
  it("respeta alergias de ingredientes y de recetas, preferencias, tiempo y comidas en casa", () => {
    const data = fixture(),
      recipe = data.recipes.find((r) => r.name === "Tostadas con tomate")!;
    data.householdMembers[0].restrictions = ["gluten"];
    expect(recipeReasons(data, recipe, "breakfast", 45).join()).toContain(
      "gluten",
    );
    data.householdMembers[0].restrictions = ["sésamo"];
    recipe.allergens = ["sésamo"];
    expect(recipeReasons(data, recipe, "breakfast", 45).join()).toContain(
      "sésamo",
    );
    data.householdMembers[1].preferences = ["TOMATE"];
    expect(recipeReasons(data, recipe, "breakfast", 5).join()).toContain(
      "prefiere evitar",
    );
    expect(recipeReasons(data, recipe, "breakfast", 5).join()).toContain(
      "minutos",
    );
    data.householdMembers.forEach((m) => {
      m.mealsAtHome = ["lunch"];
    });
    expect(
      generateMeals(data, data.mealPlans[0]).added.every(
        (e) => e.slot === "lunch",
      ),
    ).toBe(true);
  });
  it("no consume presupuesto con costes desconocidos y explica los huecos", () => {
    const data = fixture(),
      plan = data.mealPlans[0];
    plan.budgetCents = 100;
    const result = generateMeals(data, plan);
    expect(planCost(data, result.added).cents).toBeLessThanOrEqual(100);
    expect(result.gaps.length).toBeGreaterThan(0);
    data.recipes.forEach((r) => {
      r.estimatedCostCents = null;
    });
    expect(generateMeals(data, plan).added).toHaveLength(0);
    plan.budgetCents = null;
    expect(generateMeals(data, plan).added).toHaveLength(21);
  });
  it("conserva platos manuales y no duplica comidas al proponer otra vez", () => {
    const data = fixture(),
      plan = data.mealPlans[0];
    const first = generateMeals(data, plan).added[0];
    data.mealEntries = [first];
    const next = generateMeals(data, plan);
    expect(next.added).toHaveLength(20);
    expect(data.mealEntries).toEqual([first]);
    data.mealEntries.push(...next.added);
    expect(generateMeals(data, plan).added).toHaveLength(0);
  });
  it("aplica las repeticiones también al insertar antes de un plato ya guardado", () => {
    const data = fixture(),
      plan = data.mealPlans[0],
      recipe = data.recipes[0];
    recipe.maxRepeat = 1;
    const future = {
      ...metadata(),
      mealPlanId: plan.id,
      date: addDays(plan.startDate, 6),
      slot: "breakfast" as const,
      recipeId: recipe.id,
      servings: 2.5,
    };
    data.mealEntries = [future];
    expect(
      entryReasons(data, plan, {
        ...future,
        ...metadata(),
        date: plan.startDate,
      }).join(),
    ).toContain("repeticiones");
  });
  it("redondea cantidades después de sumar, no en cada comida", () => {
    const data = fixture(),
      plan = data.mealPlans[0],
      recipe = data.recipes[0];
    const line = data.recipeIngredients.find((i) => i.recipeId === recipe.id)!;
    line.quantityBase = 1;
    recipe.servings = 4;
    const entries = [0, 1].map((day) => ({
      ...metadata(),
      mealPlanId: plan.id,
      date: addDays(plan.startDate, day),
      slot: "breakfast" as const,
      recipeId: recipe.id,
      servings: 1,
    }));
    expect(
      consolidateIngredients(data, entries).find(
        (i) => i.ingredient.id === line.ingredientId,
      )?.quantity,
    ).toBe(1);
  });
  it("detecta duplicados, referencias rotas y fechas fuera del menú", () => {
    const data = fixture(),
      plan = data.mealPlans[0];
    data.mealEntries = generateMeals(data, plan).added;
    data.mealEntries.push({ ...data.mealEntries[0], ...metadata() });
    expect(() => validateData(data)).toThrow("Ya hay una receta");
    data.mealEntries.pop();
    data.mealEntries[0].date = addDays(plan.endDate, 1);
    expect(() => validateData(data)).toThrow("fecha");
    data.mealEntries = [];
    data.ingredients = [];
    expect(() => validateData(data)).toThrow("ingrediente");
  });
  it("completa 30 y 31 días cruzando meses sin exceder siete días de repetición", () => {
    for (const duration of [30, 31]) {
      const data = fixture(),
        plan = data.mealPlans[0];
      plan.endDate = addDays(plan.startDate, duration - 1);
      data.mealEntries = generateMeals(data, plan).added;
      expect(data.mealEntries).toHaveLength(duration * 3);
      expect(
        data.mealEntries.every((e) => entryReasons(data, plan, e).length === 0),
      ).toBe(true);
    }
  });
});
describe("Persistencia alimentaria y copias", () => {
  it("migra una base v2 sin alterar los datos anteriores", async () => {
    const name = `meal-migration-${crypto.randomUUID()}`,
      old = new Dexie(name);
    old.version(2).stores({
      ...storesV1,
      transactions: `${storesV1.transactions},incomeRuleId,occurrenceDate`,
      expenseRules: `${storesV1.expenseRules},kind`,
    });
    const category = {
      ...metadata(),
      name: "Mi categoría",
      parentId: null,
      type: "expense",
      sortOrder: 0,
      archivedAt: null,
    };
    await old.table("categories").put(category);
    old.close();
    const db = createDatabase(name);
    try {
      const data = await new DexieFinanceRepository(db).snapshot();
      expect(data.categories).toEqual([category]);
      expect(data.recipes).toEqual([]);
      expect(db.verno).toBe(4);
    } finally {
      await db.delete();
    }
  });
  it("exporta y restaura todos los datos de menús y revierte eliminaciones con referencias", async () => {
    const db = createDatabase(`meals-backup-${crypto.randomUUID()}`),
      repo = new DexieFinanceRepository(db);
    try {
      await repo.mutate((data) => {
        addMealDemo(data);
        data.mealEntries.push(...generateMeals(data, data.mealPlans[0]).added);
      });
      const before = await repo.snapshot(),
        backup = await exportBackup(db);
      expect(backup.schemaVersion).toBe(4);
      await repo.startFresh();
      await restoreBackup(backup, db);
      expect(await repo.snapshot()).toEqual(before);
      await expect(
        repo.remove("recipes", before.mealEntries[0].recipeId),
      ).rejects.toThrow("Quita primero");
      await expect(
        repo.remove("ingredients", before.ingredients[0].id),
      ).rejects.toThrow();
      expect(await repo.snapshot()).toEqual(before);
      await repo.remove("mealPlans", before.mealPlans[0].id);
      expect((await repo.snapshot()).mealEntries).toHaveLength(0);
    } finally {
      await db.delete();
    }
  });
  it("verifica la copia v2 antes de migrarla y permite volver a validar la vista previa", async () => {
    const full = emptyData();
    const {
      householdMembers,
      ingredients,
      recipes,
      recipeIngredients,
      mealPlans,
      mealEntries,
      ...legacy
    } = full;
    expect(
      [
        householdMembers,
        ingredients,
        recipes,
        recipeIngredients,
        mealPlans,
        mealEntries,
      ].flat(),
    ).toHaveLength(0);
    const payload = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      appVersion: "1.0.0",
      data: Object.fromEntries(
        Object.entries(legacy).filter(([key]) => !(key in shoppingTables)),
      ),
    };
    const raw = { ...payload, checksum: await checksum(payload) };
    const migrated = await validateBackup(raw);
    expect(migrated.data).toEqual(full);
    expect(await validateBackup(migrated)).toEqual(migrated);
    await expect(
      validateBackup({ ...raw, appVersion: "changed" }),
    ).rejects.toThrow("checksum");
  });
});
