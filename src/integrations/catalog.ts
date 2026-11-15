import { z } from "zod";
import { dateSchema } from "@/domain/models";
import { allergens } from "@/domain/meal-models";
export const catalogFields = [
  "sku",
  "name",
  "packageQuantity",
  "unit",
  "group",
  "priceCents",
  "observedAt",
  "sourceReference",
  "storeContext",
  "variableWeight",
  "allergens",
  "labelChecked",
] as const;
export const catalogLabels: Record<(typeof catalogFields)[number], string> = {
  sku: "Referencia",
  name: "Producto",
  packageQuantity: "Contenido del envase",
  unit: "Unidad (g/ml/ud)",
  group: "Grupo (food/hygiene/cleaning)",
  priceCents: "Precio en céntimos",
  observedAt: "Fecha del precio",
  sourceReference: "Fuente",
  storeContext: "Tienda o zona",
  variableWeight: "Peso variable",
  allergens: "Alérgenos (separados por |)",
  labelChecked: "Etiqueta revisada",
};
export const catalogRowSchema = z
  .object({
    sku: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(160),
    packageQuantity: z.number().int().min(1).max(10000000),
    unit: z.enum(["g", "ml", "ud"]),
    group: z.enum(["food", "hygiene", "cleaning"]),
    priceCents: z.number().int().min(0).max(999999999),
    observedAt: dateSchema,
    sourceReference: z.string().trim().min(1).max(160),
    storeContext: z.string().trim().min(1).max(160),
    variableWeight: z.boolean(),
    allergens: z.array(z.enum(allergens)),
    labelChecked: z.boolean(),
  })
  .strict();
export type CatalogRow = z.infer<typeof catalogRowSchema>;
export type CatalogInput = {
  headers: string[];
  records: Record<string, unknown>[];
};
export function parseCatalog(
  text: string,
  format: "csv" | "json",
): CatalogInput {
  if (text.length > 5 * 1024 * 1024)
    throw new Error("El catálogo supera los 5 MB.");
  if (format === "json") {
    const rows: unknown = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (
      !Array.isArray(rows) ||
      !rows.length ||
      rows.length > 5000 ||
      rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))
    )
      throw new Error(
        "El JSON debe contener una lista de entre 1 y 5.000 productos.",
      );
    return {
      headers: [...new Set(rows.flatMap((r) => Object.keys(r)))],
      records: rows as Record<string, unknown>[],
    };
  }
  const source = text.replace(/^\uFEFF/, ""),
    first = source.split(/\r?\n/)[0];
  const delimiter =
    (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let n = 0; n < source.length; n++) {
    const c = source[n];
    if (c === '"') {
      if (quoted && source[n + 1] === '"') {
        field += '"';
        n++;
      } else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(field);
      field = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && source[n + 1] === "\n") n++;
      row.push(field);
      if (row.some((s) => s.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Hay comillas sin cerrar en el CSV.");
  row.push(field);
  if (row.some((s) => s.trim())) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim()) ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw new Error("El CSV necesita cabeceras únicas y no vacías.");
  if (!rows.length || rows.length > 5000)
    throw new Error("Importa entre 1 y 5.000 productos.");
  return {
    headers,
    records: rows.map((r, n) => {
      if (r.length !== headers.length)
        throw new Error(
          `La fila ${n + 2} no tiene el mismo número de columnas que la cabecera.`,
        );
      return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
    }),
  };
}
export function validateCatalog(
  input: CatalogInput,
  mapping: Record<string, string>,
  currentDate: string,
) {
  const rows: CatalogRow[] = [],
    errors: string[] = [],
    seen = new Set<string>();
  const bool = (v: unknown) =>
    v === true || v === "true"
      ? true
      : v === false || v === "false" || v === "" || v === undefined
        ? false
        : v;
  input.records.forEach((record, index) => {
    const r = Object.fromEntries(
      catalogFields.map((k) => [
        k,
        mapping[k] === undefined
          ? record[k]
          : mapping[k]
            ? record[mapping[k]]
            : undefined,
      ]),
    );
    const parsed = catalogRowSchema.safeParse({
      ...r,
      packageQuantity:
        r.packageQuantity == null ||
        r.packageQuantity === "" ||
        typeof r.packageQuantity === "boolean"
          ? NaN
          : Number(r.packageQuantity),
      priceCents:
        r.priceCents == null ||
        r.priceCents === "" ||
        typeof r.priceCents === "boolean"
          ? NaN
          : Number(r.priceCents),
      group: r.group || "food",
      variableWeight: bool(r.variableWeight),
      labelChecked: bool(r.labelChecked),
      allergens: Array.isArray(r.allergens)
        ? r.allergens
        : typeof r.allergens === "string"
          ? r.allergens
              .split("|")
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
    });
    if (!parsed.success) {
      errors.push(
        `Fila ${index + 1}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
      return;
    }
    if (parsed.data.observedAt > currentDate)
      errors.push(`Fila ${index + 1}: la fecha del precio está en el futuro.`);
    if (seen.has(parsed.data.sku))
      errors.push(`Fila ${index + 1}: referencia ${parsed.data.sku} repetida.`);
    seen.add(parsed.data.sku);
    rows.push(parsed.data);
  });
  return { rows, errors };
}
export interface CatalogProvider {
  id: string;
  importCatalog(input: Uint8Array, format: "csv" | "json"): CatalogInput;
  validateRecords(
    input: CatalogInput,
    mapping: Record<string, string>,
    date: string,
  ): ReturnType<typeof validateCatalog>;
  normalizeProduct(raw: unknown): CatalogRow | null;
}
export const MercadonaImportProvider: CatalogProvider = {
  id: "mercadona-import",
  importCatalog: (input, format) =>
    parseCatalog(new TextDecoder().decode(input), format),
  validateRecords: validateCatalog,
  normalizeProduct: (raw) => {
    const parsed = catalogRowSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  },
};
