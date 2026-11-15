import type { Category, Data } from "./models";
import { occurrences } from "./calendar";
import { sum } from "./money";
export function descendants(categories: Category[], root: string): Set<string> {
  const result = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of categories)
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        changed = true;
      }
  }
  return result;
}
export function fundBalance(data: Data, fundId: string, before?: string) {
  return sum(
    data.fundEntries
      .filter((e) => e.fundId === fundId && (!before || e.date < before))
      .map((e) =>
        e.entryType === "contribution" ? e.amountCents : -e.amountCents,
      ),
  );
}
export function categoryTotal(data: Data, categoryId: string, period: string) {
  const ids = descendants(data.categories, categoryId);
  return sum(
    data.expenseRules
      .filter((r) => ids.has(r.categoryId))
      .map((r) => r.amountCents * occurrences(r, period).length),
  );
}
export function summary(data: Data, period: string) {
  const budget = data.monthlyBudgets.find((b) => b.period === period);
  const payments = data.expenseRules
    .flatMap((rule) =>
      occurrences(rule, period).map((date) => {
        const paid = sum(
          data.transactions
            .filter(
              (t) =>
                t.direction === "expense" &&
                t.expenseRuleId === rule.id &&
                t.occurrenceDate === date,
            )
            .map((t) => t.amountCents),
        );
        return {
          rule,
          date,
          paid,
          remaining: Math.max(0, rule.amountCents - paid),
        };
      }),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.rule.id.localeCompare(b.rule.id),
    );
  const plannedIncome = sum(
    data.incomeRules.map((r) => r.amountCents * occurrences(r, period).length),
  );
  const fixed = sum(
    payments
      .filter((p) => p.rule.kind === "fixed")
      .map((p) => p.rule.amountCents),
  );
  const variablePayments = sum(
    payments
      .filter((p) => p.rule.kind === "variable")
      .map((p) => p.rule.amountCents),
  );
  const allocations = data.budgetAllocations.filter((a) => a.period === period);
  const coveredCategories = new Set(
    allocations.flatMap((a) => [...descendants(data.categories, a.categoryId)]),
  );
  const variableBudget =
    sum(allocations.map((a) => a.amountCents)) +
    sum(
      payments
        .filter(
          (p) =>
            p.rule.kind === "variable" &&
            !coveredCategories.has(p.rule.categoryId),
        )
        .map((p) => p.rule.amountCents),
    );
  const activeFunds = data.sinkingFunds.filter(
    (f) =>
      f.active &&
      f.startDate.slice(0, 7) <= period &&
      f.dueDate.slice(0, 7) >= period,
  );
  const provisions = sum(activeFunds.map((f) => f.monthlyCents));
  // Projected funding uses balances BEFORE the month plus planned contributions, never the balance after paying.
  const fundAvailable = new Map(
    data.sinkingFunds.map((f) => [
      f.id,
      Math.max(
        0,
        fundBalance(data, f.id, `${period}-01`) +
          (activeFunds.includes(f) ? f.monthlyCents : 0),
      ),
    ]),
  );
  let funded = 0;
  for (const p of payments.filter(
    (p) => p.rule.kind === "fixed" && p.rule.fundId,
  )) {
    const id = p.rule.fundId!;
    const amount = Math.min(p.rule.amountCents, fundAvailable.get(id) || 0);
    funded += amount;
    fundAvailable.set(id, (fundAvailable.get(id) || 0) - amount);
  }
  const tx = data.transactions.filter((t) => t.date.startsWith(period));
  const actualIncome = sum(
    tx.filter((t) => t.direction === "income").map((t) => t.amountCents),
  );
  const actualExpense = sum(
    tx.filter((t) => t.direction === "expense").map((t) => t.amountCents),
  );
  const actualVariable = sum(
    tx
      .filter(
        (t) =>
          t.direction === "expense" &&
          (t.expenseKind ||
            data.expenseRules.find((r) => r.id === t.expenseRuleId)?.kind ||
            "variable") === "variable",
      )
      .map((t) => t.amountCents),
  );
  const savingsTarget = budget?.savingsTargetCents || 0;
  const actualSavings = sum(
    tx
      .filter((t) => t.direction.startsWith("savings"))
      .map((t) =>
        t.direction === "savings_in" ? t.amountCents : -t.amountCents,
      ),
  );
  const unallocated =
    plannedIncome -
    (fixed - funded) -
    variableBudget -
    provisions -
    savingsTarget;
  const allocationStats = allocations.map((a) => {
    const ids = descendants(data.categories, a.categoryId);
    return {
      ...a,
      name: data.categories.find((c) => c.id === a.categoryId)?.name || "",
      planned: sum(
        payments
          .filter(
            (p) => p.rule.kind === "variable" && ids.has(p.rule.categoryId),
          )
          .map((p) => p.rule.amountCents),
      ),
      actual: sum(
        tx
          .filter(
            (t) =>
              t.direction === "expense" &&
              t.categoryId &&
              ids.has(t.categoryId) &&
              (t.expenseKind ||
                data.expenseRules.find((r) => r.id === t.expenseRuleId)?.kind ||
                "variable") === "variable",
          )
          .map((t) => t.amountCents),
      ),
    };
  });
  const plannedExpenses =
    fixed +
    variableBudget +
    sum(allocationStats.map((a) => Math.max(0, a.planned - a.amountCents)));
  return {
    payments,
    plannedIncome,
    fixed,
    funded,
    variablePayments,
    variableBudget,
    provisions,
    savingsTarget,
    unallocated,
    actualIncome,
    actualExpense,
    actualVariable,
    actualSavings,
    net: actualIncome - actualExpense,
    availableCash:
      (budget?.openingCashCents || 0) + actualIncome - actualExpense,
    plannedExpenses,
    plannedCashResult: plannedIncome - plannedExpenses,
    allocationStats,
  };
}
