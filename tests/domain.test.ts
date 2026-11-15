import { describe, expect, it } from "vitest";
import {
  metadata,
  emptyData,
  type ExpenseRule,
  type Data,
} from "../src/domain/models";
import { occurrences, shiftMonth } from "../src/domain/calendar";
import { moneyInput, monthlyProvision, parseMoney } from "../src/domain/money";
import { categoryTotal, summary } from "../src/domain/finance";
import { validateData } from "../src/domain/validation";
export function fixture(): {
  data: Data;
  rule: ExpenseRule;
  categoryId: string;
} {
  const data = emptyData();
  const categoryId = crypto.randomUUID();
  data.categories.push({
    ...metadata(),
    id: categoryId,
    name: "Educación e hijos",
    parentId: null,
    type: "expense",
    sortOrder: 0,
    archivedAt: null,
  });
  const rule: ExpenseRule = {
    ...metadata(),
    name: "Comedor",
    categoryId,
    amountCents: 13000,
    frequency: "MONTHLY",
    activeMonths: [],
    dueDay: 5,
    startDate: "2026-01-01",
    endDate: null,
    archivedAt: null,
    kind: "fixed",
    fundId: null,
    notes: "",
  };
  data.expenseRules.push(rule);
  return { data, rule, categoryId };
}
describe("Dinero exacto", () => {
  it("interpreta decimales sin calcular con floats", () => {
    expect(parseMoney("0,10") + parseMoney("0,20")).toBe(30);
    expect(parseMoney("1234.56")).toBe(123456);
    expect(parseMoney("-120,05")).toBe(-12005);
    expect(moneyInput(-1)).toBe("-0,01");
  });
  it.each(["1.234,56", "0,001", "abc", "Infinity", "1e3", "10.00.00", ""])(
    "rechaza %s",
    (input) => expect(() => parseMoney(input)).toThrow(),
  );
  it("redondea las reservas hacia arriba al céntimo", () => {
    expect(monthlyProvision(54000, 12)).toBe(4500);
    expect(monthlyProvision(75000, 12)).toBe(6250);
    expect(monthlyProvision(100, 3)).toBe(34);
  });
});
describe("Calendarios locales", () => {
  it("aplica septiembre-junio y respeta inicio y fin", () => {
    const { rule } = fixture();
    rule.activeMonths = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12];
    expect(occurrences(rule, "2026-10")).toEqual(["2026-10-05"]);
    expect(occurrences(rule, "2026-07")).toEqual([]);
    rule.endDate = "2026-09-30";
    expect(occurrences(rule, "2026-10")).toEqual([]);
  });
  it("el seguro anual solo sale el mes que vence", () => {
    const { rule } = fixture();
    rule.frequency = "YEARLY";
    rule.startDate = "2026-03-01";
    rule.dueDay = 10;
    expect(occurrences(rule, "2026-03")).toEqual(["2026-03-10"]);
    expect(occurrences(rule, "2026-04")).toEqual([]);
    expect(occurrences(rule, "2027-03")).toEqual(["2027-03-10"]);
  });
  it("ajusta el 31 y contempla años bisiestos", () => {
    const { rule } = fixture();
    rule.dueDay = 31;
    expect(occurrences(rule, "2026-02")).toEqual(["2026-02-28"]);
    expect(occurrences(rule, "2028-02")).toEqual(["2028-02-29"]);
  });
  it("cuenta semanas reales, también al cambiar de año", () => {
    const { rule } = fixture();
    rule.frequency = "WEEKLY";
    rule.startDate = "2025-12-29";
    expect(occurrences(rule, "2026-01")).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ]);
    rule.startDate = "2026-01-02";
    expect(occurrences(rule, "2026-01")).toHaveLength(5);
  });
  it("resuelve trimestres, única vez y cambios de año", () => {
    const { rule } = fixture();
    rule.frequency = "QUARTERLY";
    rule.startDate = "2025-11-01";
    expect(occurrences(rule, "2026-02")).toEqual(["2026-02-05"]);
    expect(occurrences(rule, "2026-01")).toEqual([]);
    rule.frequency = "ONE_OFF";
    expect(occurrences(rule, "2025-11")).toEqual(["2025-11-01"]);
    expect(occurrences(rule, "2026-11")).toEqual([]);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("respeta meses personalizados y el día inicial exacto", () => {
    const { rule } = fixture();
    rule.frequency = "CUSTOM_MONTHS";
    rule.activeMonths = [2, 10];
    rule.startDate = "2026-02-20";
    expect(occurrences(rule, "2026-02")).toEqual([]);
    expect(occurrences(rule, "2026-10")).toHaveLength(1);
    expect(occurrences(rule, "2026-11")).toHaveLength(0);
  });
});
describe("Presupuesto sin duplicados", () => {
  it("actualiza 205 → 225 y agrega tres niveles una sola vez", () => {
    const { data, rule, categoryId } = fixture();
    const child = {
      ...data.categories[0],
      ...metadata(),
      name: "Actividades",
      parentId: categoryId,
    };
    const leaf = {
      ...child,
      ...metadata(),
      name: "Deporte",
      parentId: child.id,
    };
    data.categories.push(child, leaf);
    data.expenseRules.push({
      ...rule,
      ...metadata(),
      name: "Extraescolares",
      amountCents: 7500,
      categoryId: leaf.id,
    });
    expect(categoryTotal(data, categoryId, "2026-10")).toBe(20500);
    expect(summary(data, "2026-10").fixed).toBe(20500);
    rule.amountCents = 15000;
    expect(categoryTotal(data, categoryId, "2026-10")).toBe(22500);
    expect(summary(data, "2026-10").fixed).toBe(22500);
  });
  it("calcula 450 sin asignar, sin llamar ahorro al déficit", () => {
    const { data, rule, categoryId } = fixture();
    rule.amountCents = 165000;
    const { categoryId: _c, kind: _k, fundId: _f, notes: _n, ...income } = rule;
    void [_c, _k, _f, _n];
    data.incomeRules.push({
      ...income,
      ...metadata(),
      amountCents: 300000,
      status: "estimated",
    });
    data.budgetAllocations.push({
      ...metadata(),
      categoryId,
      period: "2026-10",
      amountCents: 25000,
      allocationType: "variable",
    });
    data.monthlyBudgets.push({
      period: "2026-10",
      openingCashCents: 0,
      savingsTargetCents: 50000,
      status: "draft",
      updatedAt: new Date().toISOString(),
    });
    data.sinkingFunds.push({
      ...metadata(),
      name: "Reservas",
      monthlyCents: 15000,
      targetCents: 180000,
      dueDate: "2027-01-01",
      startDate: "2026-01-01",
      active: true,
    });
    expect(summary(data, "2026-10").unallocated).toBe(45000);
    expect(summary(data, "2026-10").actualSavings).toBe(0);
    rule.amountCents = 220000;
    expect(summary(data, "2026-10").unallocated).toBe(-10000);
  });
  it("no asigna dos veces un seguro cubierto con una provisión", () => {
    const { data, rule } = fixture();
    const fund = {
      ...metadata(),
      name: "Seguro",
      monthlyCents: 4500,
      targetCents: 54000,
      dueDate: "2026-03-20",
      startDate: "2025-04-01",
      active: true,
    };
    data.sinkingFunds.push(fund);
    data.fundEntries.push({
      ...metadata(),
      fundId: fund.id,
      amountCents: 49500,
      date: "2026-02-28",
      entryType: "contribution",
      transactionId: null,
    });
    Object.assign(rule, {
      amountCents: 54000,
      startDate: "2026-03-01",
      frequency: "YEARLY",
      fundId: fund.id,
    });
    const s = summary(data, "2026-03");
    expect(s.fixed).toBe(54000);
    expect(s.funded).toBe(54000);
    expect(s.unallocated).toBe(-4500);
    expect(summary(data, "2026-04").fixed).toBe(0);
    expect(s.actualExpense).toBe(0);
  });
  it("presupuesta la parte sin cubrir y reparte fondos entre pagos", () => {
    const { data, rule } = fixture();
    const fund = {
      ...metadata(),
      name: "Fondo",
      monthlyCents: 1000,
      targetCents: 30000,
      dueDate: "2027-01-01",
      startDate: "2026-01-01",
      active: true,
    };
    data.sinkingFunds.push(fund);
    rule.fundId = fund.id;
    data.expenseRules.push({ ...rule, ...metadata() });
    const s = summary(data, "2026-10");
    expect(s.funded).toBe(1000);
    expect(s.unallocated).toBe(-26000);
  });
  it("rechaza ciclos, referencias rotas y presupuestos solapados", () => {
    const { data, categoryId } = fixture();
    data.categories[0].parentId = categoryId;
    expect(() => validateData(data)).toThrow("ciclos");
    data.categories[0].parentId = null;
    data.expenseRules[0].categoryId = crypto.randomUUID();
    expect(() => validateData(data)).toThrow("categoría");
    data.expenseRules[0].categoryId = categoryId;
    const a = {
      ...metadata(),
      period: "2026-10",
      categoryId,
      amountCents: 10000,
      allocationType: "variable" as const,
    };
    data.budgetAllocations.push(a, { ...a, ...metadata() });
    expect(() => validateData(data)).toThrow("simultáneamente");
  });
});
