import {
  emptyData,
  metadata,
  type Data,
  type ExpenseRule,
} from "@/domain/models";
import { today, shiftMonth } from "@/domain/calendar";
export function demoData(): Data {
  const data = emptyData();
  const date = today();
  const period = date.slice(0, 7);
  const start = `${date.slice(0, 4)}-01-01`;
  const now = new Date().toISOString();
  const category = (name: string, sortOrder: number) => {
    const c = {
      ...metadata(),
      name,
      parentId: null,
      type: "expense" as const,
      sortOrder,
      archivedAt: null,
    };
    data.categories.push(c);
    return c.id;
  };
  const home = category("Vivienda", 0);
  const school = category("Educación e hijos", 1);
  const utilities = category("Suministros", 2);
  const transport = category("Transporte", 3);
  const subscriptions = category("Suscripciones", 4);
  const health = category("Salud", 5);
  const food = category("Alimentación", 6);
  category("Ocio y bienestar", 7);
  category("Seguros", 8);
  function expense(
    name: string,
    amountCents: number,
    categoryId: string,
    dueDay: number,
    months: number[] = [],
  ): ExpenseRule {
    const rule: ExpenseRule = {
      ...metadata(),
      name,
      amountCents,
      categoryId,
      dueDay,
      frequency: "MONTHLY",
      activeMonths: months,
      startDate: start,
      endDate: null,
      kind: "fixed",
      fundId: null,
      notes: "",
      archivedAt: null,
    };
    data.expenseRules.push(rule);
    return rule;
  }
  const rent = expense("Alquiler de casa", 90000, home, 1);
  expense(
    "Comedor escolar",
    13000,
    school,
    5,
    [1, 2, 3, 4, 5, 6, 9, 10, 11, 12],
  );
  expense("Extraescolares", 7500, school, 5, [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]);
  expense("Luz, agua e internet", 14500, utilities, 15);
  expense("Transporte familiar", 20000, transport, 18);
  expense("Suscripciones", 5000, subscriptions, 20);
  expense("Salud y cuidados", 15000, health, 22);
  const income = {
    ...metadata(),
    name: "Ingresos de la familia",
    amountCents: 300000,
    dueDay: 1,
    frequency: "MONTHLY" as const,
    activeMonths: [],
    startDate: start,
    endDate: null,
    archivedAt: null,
    status: "confirmed" as const,
  };
  data.incomeRules.push(income);
  data.monthlyBudgets.push({
    period,
    openingCashCents: 0,
    savingsTargetCents: 50000,
    status: "draft",
    updatedAt: now,
  });
  data.budgetAllocations.push({
    ...metadata(),
    period,
    categoryId: food,
    amountCents: 25000,
    allocationType: "variable",
  });
  const fund = {
    ...metadata(),
    name: "Seguro del coche",
    targetCents: 54000,
    monthlyCents: 4500,
    startDate: start,
    dueDate: `${shiftMonth(period, 4)}-15`,
    active: true,
  };
  data.sinkingFunds.push(fund, {
    ...metadata(),
    name: "Gastos del próximo curso",
    targetCents: 126000,
    monthlyCents: 10500,
    startDate: start,
    dueDate: `${shiftMonth(period, 10)}-01`,
    active: true,
  });
  data.fundEntries.push({
    ...metadata(),
    fundId: fund.id,
    date: `${period}-01`,
    entryType: "contribution",
    amountCents: 27000,
    transactionId: null,
  });
  const goal = {
    ...metadata(),
    name: "Fondo de emergencia",
    targetCents: 300000,
    deadline: `${shiftMonth(period, 12)}-01`,
    active: true,
  };
  data.savingsGoals.push(goal);
  const baseTx = {
    date: `${period}-01`,
    categoryId: null,
    expenseRuleId: null,
    incomeRuleId: null,
    occurrenceDate: null,
    fundId: null,
    goalId: null,
    source: "demo" as const,
  };
  data.transactions.push(
    {
      ...metadata(),
      ...baseTx,
      direction: "income",
      amountCents: 300000,
      memo: income.name,
      incomeRuleId: income.id,
    },
    {
      ...metadata(),
      ...baseTx,
      direction: "expense",
      amountCents: 90000,
      categoryId: home,
      memo: rent.name,
      expenseRuleId: rent.id,
      occurrenceDate: `${period}-01`,
    },
    {
      ...metadata(),
      ...baseTx,
      direction: "expense",
      amountCents: 8640,
      categoryId: food,
      memo: "Compra de la semana",
    },
    {
      ...metadata(),
      ...baseTx,
      direction: "savings_in",
      amountCents: 30000,
      goalId: goal.id,
      memo: "Aportación al colchón familiar",
    },
  );
  for (const t of data.transactions)
    t.expenseKind =
      t.direction === "expense"
        ? data.expenseRules.find((r) => r.id === t.expenseRuleId)?.kind ||
          "variable"
        : null;
  data.settings.push(
    { key: "initialized", value: true, updatedAt: now },
    { key: "demo", value: true, updatedAt: now },
  );
  return data;
}
