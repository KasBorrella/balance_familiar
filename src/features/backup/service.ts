import { z } from "zod";
import { shoppingTables, emptyShopping } from "@/domain/shopping-models";
import { dataSchema, tableNames } from "@/domain/models";
import { validateData } from "@/domain/validation";
import { db, replaceData, type FinanceDB } from "@/db/database";
import { DexieFinanceRepository } from "@/db/repository";
const envelope = z
  .object({
    schemaVersion: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    exportedAt: z.string().datetime(),
    appVersion: z.string(),
    data: z.unknown(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Backup = Omit<z.infer<typeof envelope>, "data"> & {
  data: z.infer<typeof dataSchema>;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function checksum(data: unknown) {
  const bytes = new TextEncoder().encode(canonical(data));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export async function exportBackup(database: FinanceDB = db): Promise<Backup> {
  const data = await new DexieFinanceRepository(database).snapshot();
  validateData(data);
  const payload = {
    schemaVersion: 4 as const,
    exportedAt: new Date().toISOString(),
    appVersion: "1.2.0",
    data,
  };
  return { ...payload, checksum: await checksum(payload) };
}
export async function validateBackup(input: unknown) {
  const backup = envelope.parse(input);
  const { checksum: hash, ...payload } = backup;
  if (hash !== (await checksum(payload)))
    throw new Error(
      "El archivo está incompleto o ha sido modificado (checksum incorrecto).",
    );
  const phase2Schema = dataSchema.omit(shoppingTables);
  const legacySchema = phase2Schema.omit({
    householdMembers: true,
    ingredients: true,
    recipes: true,
    recipeIngredients: true,
    mealPlans: true,
    mealEntries: true,
  });
  const data = validateData(
    backup.schemaVersion === 2
      ? {
          ...legacySchema.parse(backup.data),
          householdMembers: [],
          ingredients: [],
          recipes: [],
          recipeIngredients: [],
          mealPlans: [],
          mealEntries: [],
          ...emptyShopping(),
        }
      : backup.schemaVersion === 3
        ? { ...phase2Schema.parse(backup.data), ...emptyShopping() }
        : backup.data,
  );
  const migrated = { ...payload, schemaVersion: 4 as const, data };
  return { ...migrated, checksum: await checksum(migrated) };
}
export async function restoreBackup(input: unknown, database: FinanceDB = db) {
  const backup = await validateBackup(input);
  await database.transaction(
    "rw",
    tableNames.map((n) => database.table(n)),
    () => replaceData(database, backup.data),
  );
}
