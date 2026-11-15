import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { createDatabase, type FinanceDB, storesV1 } from "../src/db/database";
import { DexieFinanceRepository } from "../src/db/repository";
import { demoData } from "../src/db/demo";
import { metadata, type Transaction } from "../src/domain/models";
import {
  exportBackup,
  restoreBackup,
  validateBackup,
  checksum,
} from "../src/features/backup/service";
import { summary, fundBalance } from "../src/domain/finance";
import { today } from "../src/domain/calendar";
let db: FinanceDB;
let repo: DexieFinanceRepository;
beforeEach(() => {
  db = createDatabase(`test-${crypto.randomUUID()}`);
  repo = new DexieFinanceRepository(db);
});
afterEach(async () => {
  await db.delete();
});
describe("Persistencia y atomicidad", () => {
  it("inicia demo una vez; cerrar/reabrir conserva cambios y vaciar no repone demo", async () => {
    await repo.initialize();
    const data = await repo.snapshot();
    expect(data.settings.find((s) => s.key === "demo")?.value).toBe(true);
    const r = { ...data.expenseRules[0], amountCents: 12345 };
    await repo.save("expenseRules", r);
    db.close();
    await db.open();
    await repo.initialize();
    expect((await repo.snapshot()).expenseRules[0].amountCents).toBe(12345);
    await repo.startFresh();
    await repo.initialize();
    expect((await repo.snapshot()).expenseRules).toHaveLength(0);
  });
  it("no altera movimientos al editar o borrar una regla", async () => {
    await repo.initialize();
    const data = await repo.snapshot();
    const rule = data.expenseRules.find((r) =>
      data.transactions.some((t) => t.expenseRuleId === r.id),
    )!;
    const before = data.transactions.find((t) => t.expenseRuleId === rule.id)!;
    await repo.save("expenseRules", { ...rule, amountCents: 15000 });
    expect(
      (await repo.snapshot()).transactions.find((t) => t.id === before.id),
    ).toEqual(before);
    await repo.remove("expenseRules", rule.id);
    const after = (await repo.snapshot()).transactions.find(
      (t) => t.id === before.id,
    )!;
    expect(after.amountCents).toBe(before.amountCents);
    expect(after.memo).toBe(before.memo);
    expect(after.expenseRuleId).toBeNull();
  });
  it("bloquea referencias rotas sin perder datos", async () => {
    await repo.initialize();
    const before = await repo.snapshot();
    await expect(
      repo.remove("categories", before.expenseRules[0].categoryId),
    ).rejects.toThrow();
    expect(await repo.snapshot()).toEqual(before);
  });
  it("registra pago y consumo del fondo atómicamente, y revierte al borrar", async () => {
    await repo.initialize();
    const data = await repo.snapshot();
    const fund = data.sinkingFunds.find((f) => fundBalance(data, f.id) > 0)!;
    const t: Transaction = {
      ...metadata(),
      date: today(),
      direction: "expense",
      amountCents: 10000,
      categoryId: data.categories[0].id,
      expenseRuleId: null,
      incomeRuleId: null,
      occurrenceDate: null,
      fundId: fund.id,
      goalId: null,
      memo: "Pago con fondo",
      source: "demo",
    };
    const balance = fundBalance(data, fund.id);
    await repo.saveTransaction(t);
    const after = await repo.snapshot();
    expect(fundBalance(after, fund.id)).toBe(balance - 10000);
    expect(
      summary(after, today().slice(0, 7)).actualExpense -
        summary(data, today().slice(0, 7)).actualExpense,
    ).toBe(10000);
    await expect(
      repo.saveTransaction({ ...t, amountCents: 99999999 }),
    ).rejects.toThrow("Saldo insuficiente");
    expect(await repo.snapshot()).toEqual(after);
    await repo.remove("transactions", t.id);
    expect(fundBalance(await repo.snapshot(), fund.id)).toBe(balance);
  });
  it("rechaza pagos del fondo anteriores a sus aportaciones", async () => {
    await repo.initialize();
    const data = await repo.snapshot();
    const fund = data.sinkingFunds[0];
    await expect(
      repo.save("fundEntries", {
        ...metadata(),
        fundId: fund.id,
        date: "2020-01-01",
        entryType: "withdrawal",
        amountCents: 1,
        transactionId: null,
      }),
    ).rejects.toThrow("Saldo insuficiente");
  });
});
describe("Backup verificable", () => {
  it("exporta y restaura exactamente, sin añadir metadatos a los datos restaurados", async () => {
    await repo.initialize();
    const original = await repo.snapshot();
    const backup = await exportBackup(db);
    await repo.startFresh();
    await restoreBackup(JSON.parse(JSON.stringify(backup)), db);
    expect(await repo.snapshot()).toEqual(original);
  });
  it("rechaza corrupción, versiones desconocidas, duplicados y referencias rotas", async () => {
    await repo.initialize();
    const backup = await exportBackup(db);
    await expect(
      validateBackup({ ...backup, schemaVersion: 999 }),
    ).rejects.toThrow();
    const corrupt = structuredClone(backup);
    corrupt.data.expenseRules[0].amountCents++;
    await expect(restoreBackup(corrupt, db)).rejects.toThrow("checksum");
    const invalid = structuredClone(backup);
    invalid.data.expenseRules[0].categoryId = crypto.randomUUID();
    const { checksum: _hash, ...payload } = invalid;
    void _hash;
    invalid.checksum = await checksum(payload);
    await expect(restoreBackup(invalid, db)).rejects.toThrow("categoría");
    expect(await repo.snapshot()).toEqual(backup.data);
    const duplicate = structuredClone(backup);
    duplicate.data.categories.push(duplicate.data.categories[0]);
    const { checksum: _h, ...p } = duplicate;
    void _h;
    duplicate.checksum = await checksum(p);
    await expect(validateBackup(duplicate)).rejects.toThrow("duplicados");
  });
  it("revierte un fallo de escritura durante una restauración", async () => {
    await repo.initialize();
    const before = await repo.snapshot();
    const backup = await exportBackup(db);
    backup.data.expenseRules = [];
    backup.data.transactions = [];
    const { checksum: _h, ...payload } = backup;
    void _h;
    backup.checksum = await checksum(payload);
    const fail = () => {
      throw new Error("Cuota simulada");
    };
    db.table("savingsGoals").hook("creating", fail);
    await expect(restoreBackup(backup, db)).rejects.toThrow("Cuota simulada");
    db.table("savingsGoals").hook("creating").unsubscribe(fail);
    expect(await repo.snapshot()).toEqual(before);
  });
});
it("migra una base v1 sin borrar movimientos", async () => {
  const name = db.name;
  db.close();
  const old = new Dexie(name);
  old.version(1).stores(storesV1);
  const data = demoData();
  const tx = { ...data.transactions.find((t) => t.expenseRuleId)! };
  const originalId = tx.id;
  const legacy: Record<string, unknown> = { ...tx };
  delete legacy.occurrenceDate;
  delete legacy.incomeRuleId;
  await old.table("transactions").put(legacy);
  old.close();
  await db.open();
  const migrated = await db.table("transactions").get(originalId);
  expect(migrated.amountCents).toBe(tx.amountCents);
  expect(migrated.occurrenceDate).toBe(tx.date);
  expect(migrated.incomeRuleId).toBeNull();
});
