import { expect, it } from "vitest";
import { createDatabase } from "../src/db/database";
import { DexieFinanceRepository } from "../src/db/repository";
import { summary } from "../src/domain/finance";
import { today } from "../src/domain/calendar";
import { metadata } from "../src/domain/models";
it("conserva la clasificación real al cambiar o eliminar una regla", async () => {
  const database = createDatabase(`history-${crypto.randomUUID()}`);
  const repo = new DexieFinanceRepository(database);
  try {
    await repo.initialize();
    const original = await repo.snapshot();
    const period = today().slice(0, 7);
    const rule = original.expenseRules.find((r) =>
      original.transactions.some((t) => t.expenseRuleId === r.id),
    )!;
    const variableBefore = summary(original, period).actualVariable;
    await repo.save("expenseRules", { ...rule, kind: "variable" });
    expect(summary(await repo.snapshot(), period).actualVariable).toBe(
      variableBefore,
    );
    await repo.remove("expenseRules", rule.id);
    expect(summary(await repo.snapshot(), period).actualVariable).toBe(
      variableBefore,
    );
  } finally {
    await database.delete();
  }
});
it("la previsión de caja respeta excesos por categoría, sin compensarlos con límites ajenos", async () => {
  const database = createDatabase(`budgets-${crypto.randomUUID()}`);
  const repo = new DexieFinanceRepository(database);
  try {
    await repo.initialize();
    const data = await repo.snapshot();
    const period = today().slice(0, 7);
    const food = data.categories.find((c) => c.name === "Alimentación")!;
    const ocio = data.categories.find((c) => c.name === "Ocio y bienestar")!;
    await repo.save("expenseRules", {
      ...data.expenseRules[0],
      ...metadata(),
      categoryId: food.id,
      kind: "variable",
      fundId: null,
      amountCents: 30000,
      activeMonths: [],
      dueDay: 1,
    });
    await repo.save("budgetAllocations", {
      ...metadata(),
      period,
      categoryId: ocio.id,
      amountCents: 10000,
      allocationType: "variable",
    });
    const s = summary(await repo.snapshot(), period);
    expect(s.variableBudget).toBe(35000);
    expect(s.plannedExpenses - s.fixed).toBe(40000);
    expect(
      s.allocationStats.find((a) => a.categoryId === food.id)?.planned,
    ).toBe(30000);
  } finally {
    await database.delete();
  }
});
