import { z } from "zod";
import { dataSchema, tableNames } from "@/domain/models";
import { validateData } from "@/domain/validation";
import { db, replaceData, type FinanceDB } from "@/db/database";
import { DexieFinanceRepository } from "@/db/repository";
const envelope = z
  .object({
    schemaVersion: z.literal(2),
    exportedAt: z.string().datetime(),
    appVersion: z.string(),
    data: dataSchema,
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type Backup = z.infer<typeof envelope>;
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
    schemaVersion: 2 as const,
    exportedAt: new Date().toISOString(),
    appVersion: "1.0.0",
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
  validateData(backup.data);
  return backup;
}
export async function restoreBackup(input: unknown, database: FinanceDB = db) {
  const backup = await validateBackup(input);
  await database.transaction(
    "rw",
    tableNames.map((n) => database.table(n)),
    () => replaceData(database, backup.data),
  );
}
