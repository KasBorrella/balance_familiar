import Dexie from "dexie";
import { tableNames, type Data } from "@/domain/models";
export const storesV1 = {
  settings: "&key",
  categories: "&id,parentId,type,sortOrder",
  incomeRules: "&id,startDate",
  expenseRules: "&id,categoryId,startDate,fundId",
  monthlyBudgets: "&period",
  budgetAllocations: "&id,period,categoryId,[period+categoryId]",
  transactions: "&id,date,direction,categoryId,expenseRuleId,fundId,goalId",
  sinkingFunds: "&id,dueDate",
  fundEntries: "&id,fundId,date,transactionId,[fundId+date]",
  savingsGoals: "&id,deadline",
};
export type FinanceDB = Dexie;
export function createDatabase(name = "balance-familiar"): FinanceDB {
  const database = new Dexie(name);
  database.version(1).stores(storesV1);
  database
    .version(2)
    .stores({
      ...storesV1,
      transactions: `${storesV1.transactions},incomeRuleId,occurrenceDate`,
      expenseRules: `${storesV1.expenseRules},kind`,
    })
    .upgrade(async (tx) => {
      const rules = await tx.table("expenseRules").toArray();
      await tx
        .table("transactions")
        .toCollection()
        .modify((row) => {
          row.incomeRuleId ??= null;
          row.occurrenceDate ??= row.expenseRuleId ? row.date : null;
          row.expenseKind ??=
            row.direction === "expense"
              ? rules.find((r) => r.id === row.expenseRuleId)?.kind ||
                "variable"
              : null;
        });
      await tx
        .table("expenseRules")
        .toCollection()
        .modify((row) => {
          row.notes ??= "";
        });
    });
  return database;
}
export const db = createDatabase();
export async function readData(database: FinanceDB): Promise<Data> {
  const result = Object.fromEntries(
    await Promise.all(
      tableNames.map(async (name) => [
        name,
        await database.table(name).toArray(),
      ]),
    ),
  );
  return result as Data;
}
export async function replaceData(database: FinanceDB, data: Data) {
  for (const name of tableNames) {
    await database.table(name).clear();
    await database.table(name).bulkPut(data[name]);
  }
}
