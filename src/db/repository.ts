import Dexie from "dexie";
import { db, readData, replaceData } from "./database";
import { demoData } from "./demo";
import {
  emptyData,
  metadata,
  tableNames,
  type Data,
  type Row,
  type TableName,
  type Transaction,
} from "@/domain/models";
import { validateData, validateNewOccurrence } from "@/domain/validation";
export interface FinanceRepository {
  snapshot(): Promise<Data>;
  save<K extends TableName>(table: K, row: Row<K>): Promise<void>;
  remove(table: TableName, key: string): Promise<void>;
  saveTransaction(row: Transaction): Promise<void>;
}
export class DexieFinanceRepository implements FinanceRepository {
  constructor(readonly database: Dexie = db) {}
  async snapshot(): Promise<Data> {
    return await this.database.transaction<Data>(
      "r",
      this.database.tables,
      () => readData(this.database),
    );
  }
  async mutate(update: (data: Data) => void) {
    await this.database.transaction("rw", this.database.tables, async () => {
      const data = await readData(this.database);
      update(data);
      validateData(data);
      await replaceData(this.database, data);
    });
  }
  async initialize() {
    await this.database.transaction("rw", this.database.tables, async () => {
      if (await this.database.table("settings").get("initialized")) return;
      // Never overwrite an existing database, even if its initialization marker is missing.
      const existing = await readData(this.database);
      if (tableNames.some((n) => existing[n].length)) {
        await this.database.table("settings").put({
          key: "initialized",
          value: true,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
      await replaceData(this.database, validateData(demoData()));
    });
  }
  async save<K extends TableName>(table: K, row: Row<K>) {
    if (table === "transactions")
      return this.saveTransaction(row as Transaction);
    await this.mutate((data) => {
      if (table === "ingredients") {
        const ingredient = row as Row<"ingredients">;
        const previous = data.ingredients.find((i) => i.id === ingredient.id);
        if (
          previous &&
          previous.baseUnit !== ingredient.baseUnit &&
          (data.recipeIngredients.some(
            (i) => i.ingredientId === ingredient.id,
          ) ||
            data.ingredientProductMappings.some(
              (i) => i.ingredientId === ingredient.id,
            ) ||
            data.pantryLots.some((i) => i.ingredientId === ingredient.id) ||
            data.shoppingItems.some((i) => i.ingredientId === ingredient.id))
        )
          throw new Error(
            "Este ingrediente ya se usa en recetas. Crea otro ingrediente para cambiar de unidad sin alterar sus cantidades.",
          );
      }
      const rows = data[table] as Row<K>[];
      const key = rowKey(row);
      const index = rows.findIndex((r) => rowKey(r) === key);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    });
  }
  async saveTransaction(row: Transaction) {
    await this.mutate((data) => {
      const old = data.transactions.find((t) => t.id === row.id);
      row = {
        ...row,
        expenseKind:
          row.direction !== "expense"
            ? null
            : old?.direction === "expense" &&
                old.expenseRuleId === row.expenseRuleId &&
                old.expenseKind
              ? old.expenseKind
              : data.expenseRules.find((r) => r.id === row.expenseRuleId)
                  ?.kind || "variable",
      };
      if (
        row.expenseRuleId &&
        (!old ||
          old.expenseRuleId !== row.expenseRuleId ||
          old.occurrenceDate !== row.occurrenceDate)
      )
        validateNewOccurrence(
          data,
          row.expenseRuleId,
          row.occurrenceDate || "",
        );
      data.transactions = data.transactions.filter((t) => t.id !== row.id);
      data.transactions.push(row);
      data.fundEntries = data.fundEntries.filter(
        (e) => e.transactionId !== row.id,
      );
      if (row.fundId)
        data.fundEntries.push({
          ...metadata(),
          fundId: row.fundId,
          date: row.date,
          amountCents: row.amountCents,
          entryType: "payment",
          transactionId: row.id,
        });
    });
  }
  async remove(table: TableName, key: string) {
    await this.mutate((data) => {
      if (table === "shoppingLists") {
        if (
          data.shoppingLists.some((l) => l.id === key && l.status !== "draft")
        )
          throw new Error(
            "Las listas con compra registrada se conservan en el historial.",
          );
        data.shoppingItems = data.shoppingItems.filter((i) => i.listId !== key);
      }
      if (table === "mealPlans")
        data.mealEntries = data.mealEntries.filter((e) => e.mealPlanId !== key);
      if (table === "recipes") {
        if (data.mealEntries.some((e) => e.recipeId === key))
          throw new Error(
            "Quita primero esta receta de los menús donde aparece.",
          );
        data.recipeIngredients = data.recipeIngredients.filter(
          (i) => i.recipeId !== key,
        );
      }
      if (table === "transactions")
        data.fundEntries = data.fundEntries.filter(
          (e) => e.transactionId !== key,
        );
      if (
        table === "fundEntries" &&
        data.fundEntries.some((e) => e.id === key && e.entryType === "payment")
      )
        throw new Error(
          "Edita o elimina el movimiento asociado para cambiar este pago.",
        );
      if (table === "expenseRules")
        data.transactions = data.transactions.map((t) =>
          t.expenseRuleId === key
            ? { ...t, expenseRuleId: null, occurrenceDate: null }
            : t,
        );
      if (table === "incomeRules")
        data.transactions = data.transactions.map((t) =>
          t.incomeRuleId === key ? { ...t, incomeRuleId: null } : t,
        );
      const rows = data[table] as unknown[];
      const remaining = rows.filter(
        (row) => rowKey(row as Row<TableName>) !== key,
      );
      rows.splice(0, rows.length, ...remaining);
    });
  }
  async startFresh() {
    await this.database.transaction("rw", this.database.tables, async () => {
      const data = emptyData();
      const now = new Date().toISOString();
      data.settings = [
        { key: "initialized", value: true, updatedAt: now },
        { key: "demo", value: false, updatedAt: now },
      ];
      await replaceData(this.database, data);
    });
  }
  setSetting(key: string, value: string | number | boolean) {
    return this.save("settings", {
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  }
}
export function rowKey(row: Row<TableName>) {
  return "id" in row
    ? row.id
    : "period" in row
      ? row.period
      : "key" in row
        ? row.key
        : "";
}
export const repository = new DexieFinanceRepository();
