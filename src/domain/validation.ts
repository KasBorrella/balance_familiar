import { dataSchema, tableNames, type Data } from "./models";
import { descendants } from "./finance";
import { occurrences } from "./calendar";
export function validateData(input: unknown): Data {
  const data = dataSchema.parse(input);
  function assert(ok: unknown, message: string): asserts ok {
    if (!ok) throw new Error(message);
  }
  for (const name of tableNames) {
    const keys = data[name].map((row) =>
      "id" in row
        ? row.id
        : "period" in row
          ? row.period
          : "key" in row
            ? row.key
            : "",
    );
    assert(
      new Set(keys).size === keys.length,
      `Registros duplicados en ${name}.`,
    );
  }
  const categories = new Map(data.categories.map((c) => [c.id, c]));
  for (const c of data.categories) {
    let current = c;
    const seen = new Set([c.id]);
    let depth = 1;
    while (current.parentId) {
      const parent = categories.get(current.parentId);
      assert(parent, "La categoría superior no existe.");
      assert(!seen.has(parent.id), "Las categorías no pueden formar ciclos.");
      assert(
        parent.type === c.type,
        "El tipo de categoría debe coincidir con su padre.",
      );
      seen.add(parent.id);
      current = parent;
      depth++;
    }
    assert(depth <= 3, "Se permiten hasta tres niveles de categorías.");
  }
  for (const r of [...data.expenseRules, ...data.incomeRules]) {
    assert(
      !r.endDate || r.endDate >= r.startDate,
      "La fecha final debe ser posterior al inicio.",
    );
    assert(
      r.frequency !== "CUSTOM_MONTHS" || r.activeMonths.length > 0,
      "Selecciona al menos un mes.",
    );
    assert(
      new Set(r.activeMonths).size === r.activeMonths.length,
      "Meses duplicados.",
    );
  }
  for (const r of data.expenseRules) {
    assert(
      categories.get(r.categoryId)?.type === "expense",
      "Selecciona una categoría de gasto válida.",
    );
    assert(
      !r.fundId || data.sinkingFunds.some((f) => f.id === r.fundId),
      "El fondo no existe.",
    );
    assert(
      !r.fundId || r.kind === "fixed",
      "Los fondos se vinculan a obligaciones fijas.",
    );
  }
  for (const a of data.budgetAllocations) {
    assert(
      categories.get(a.categoryId)?.type === "expense",
      "La categoría del presupuesto no existe.",
    );
    for (const b of data.budgetAllocations.filter(
      (b) => b.period === a.period && b.id !== a.id,
    ))
      assert(
        !descendants(data.categories, a.categoryId).has(b.categoryId),
        "No asignes presupuesto simultáneamente a una categoría y a sus subcategorías.",
      );
  }
  for (const t of data.transactions) {
    assert(
      !t.categoryId || categories.has(t.categoryId),
      "La categoría del movimiento no existe.",
    );
    assert(
      t.direction !== "expense" ||
        (t.categoryId && categories.get(t.categoryId)?.type === "expense"),
      "El gasto necesita una categoría.",
    );
    assert(
      !t.fundId ||
        (t.direction === "expense" &&
          data.sinkingFunds.some((f) => f.id === t.fundId)),
      "Fondo del movimiento no válido.",
    );
    assert(
      !t.goalId ||
        (t.direction.startsWith("savings") &&
          data.savingsGoals.some((g) => g.id === t.goalId)),
      "Objetivo de ahorro no válido.",
    );
    assert(
      !t.expenseRuleId || t.direction === "expense",
      "Solo los gastos pueden vincularse a un gasto previsto.",
    );
    assert(
      !t.incomeRuleId || t.direction === "income",
      "Solo los ingresos pueden vincularse a un ingreso previsto.",
    );
    assert(
      !t.incomeRuleId || data.incomeRules.some((r) => r.id === t.incomeRuleId),
      "El ingreso previsto no existe.",
    );
    if (t.expenseRuleId) {
      const rule = data.expenseRules.find((r) => r.id === t.expenseRuleId);
      assert(rule, "El gasto previsto no existe.");
      assert(t.occurrenceDate, "Selecciona el vencimiento que estás pagando.");
    }
    if (t.fundId) {
      const entries = data.fundEntries.filter((e) => e.transactionId === t.id);
      assert(
        entries.length === 1 &&
          entries[0].entryType === "payment" &&
          entries[0].fundId === t.fundId &&
          entries[0].amountCents === t.amountCents &&
          entries[0].date === t.date,
        "El pago y la salida del fondo deben coincidir.",
      );
    }
  }
  for (const f of data.sinkingFunds) {
    assert(
      f.dueDate >= f.startDate,
      "El vencimiento del fondo debe ser posterior al inicio.",
    );
    let balance = 0;
    // Contributions on a date are available for payments that same date.
    for (const e of data.fundEntries
      .filter((e) => e.fundId === f.id)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.entryType === "contribution" ? -1 : 1),
      )) {
      balance +=
        e.entryType === "contribution" ? e.amountCents : -e.amountCents;
      assert(
        balance >= 0,
        `Saldo insuficiente en el fondo «${f.name}» en ${e.date}.`,
      );
    }
  }
  for (const e of data.fundEntries) {
    assert(
      data.sinkingFunds.some((f) => f.id === e.fundId),
      "El fondo de la aportación no existe.",
    );
    if (e.entryType === "payment")
      assert(
        data.transactions.some(
          (t) => t.id === e.transactionId && t.fundId === e.fundId,
        ),
        "El pago del fondo debe estar vinculado a un gasto.",
      );
    else
      assert(!e.transactionId, "Las aportaciones y retiradas no son gastos.");
  }
  return data;
}
export function validateNewOccurrence(
  data: Data,
  ruleId: string,
  date: string,
) {
  const rule = data.expenseRules.find((r) => r.id === ruleId);
  if (!rule || !occurrences(rule, date.slice(0, 7)).includes(date))
    throw new Error("Ese vencimiento no corresponde al calendario del gasto.");
}
