import { z } from "zod";
import { allergens } from "./meal-models";
const id = z.string().uuid(),
  name = z.string().trim().min(1).max(160);
const meta = {
  id,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
const quantity = z.number().int().min(1).max(10000000);
const cents = z.number().int().min(0).max(999999999);
export const productGroups = ["food", "hygiene", "cleaning"] as const;
export const groupLabels = {
  food: "Alimentación",
  hygiene: "Higiene",
  cleaning: "Limpieza",
};
export const shoppingTables = {
  supermarkets: true,
  products: true,
  ingredientProductMappings: true,
  priceObservations: true,
  pantryLots: true,
  shoppingLists: true,
  shoppingItems: true,
  purchases: true,
  purchaseItems: true,
  catalogImports: true,
} as const;
export function shoppingSchemas(date: z.ZodString) {
  return {
    supermarkets: z.array(
      z.object({ ...meta, name, enabled: z.boolean() }).strict(),
    ),
    products: z.array(
      z
        .object({
          ...meta,
          supermarketId: id,
          externalSku: name,
          name,
          packageQuantity: quantity,
          unit: z.enum(["g", "ml", "ud"]),
          group: z.enum(productGroups),
          variableWeight: z.boolean(),
          active: z.boolean(),
          allergens: z.array(z.enum(allergens)),
          labelChecked: z.boolean(),
        })
        .strict(),
    ),
    ingredientProductMappings: z.array(
      z
        .object({
          ...meta,
          ingredientId: id,
          productId: id,
          usableQuantity: quantity,
        })
        .strict(),
    ),
    priceObservations: z.array(
      z
        .object({
          ...meta,
          productId: id,
          priceCents: cents,
          currency: z.literal("EUR"),
          observedAt: date,
          sourceType: z.enum(["manual", "import", "demo"]),
          sourceReference: name,
          storeContext: name,
          verificationStatus: z.enum(["user_checked", "unverified", "demo"]),
        })
        .strict(),
    ),
    pantryLots: z.array(
      z
        .object({
          ...meta,
          ingredientId: id,
          productId: id.nullable(),
          quantityBase: z.number().int().min(0).max(10000000),
          expiryDate: date.nullable(),
          purchaseId: id.nullable(),
          note: z.string().max(300),
        })
        .strict(),
    ),
    shoppingLists: z.array(
      z
        .object({
          ...meta,
          mealPlanId: id,
          supermarketId: id,
          startDate: date,
          endDate: date,
          status: z.enum(["draft", "purchased", "consumed"]),
          entryIds: z.array(id),
          needs: z.array(
            z.object({ ingredientId: id, quantityBase: quantity }).strict(),
          ),
          reservations: z.array(
            z.object({ lotId: id, quantityBase: quantity }).strict(),
          ),
          warnings: z.array(z.string()),
          budgetCents: cents.nullable(),
          allowDemo: z.boolean(),
        })
        .strict(),
    ),
    shoppingItems: z.array(
      z
        .object({
          ...meta,
          listId: id,
          productId: id,
          ingredientId: id.nullable(),
          packagesCount: z.number().int().min(1).max(10000),
          usableQuantity: quantity,
          unit: z.enum(["g", "ml", "ud"]),
          group: z.enum(productGroups),
          productName: name,
          unitPriceSnapshotCents: cents,
          priceObservationId: id,
          variableWeight: z.boolean(),
        })
        .strict(),
    ),
    purchases: z.array(
      z
        .object({
          ...meta,
          listId: id,
          date,
          actualTotalCents: cents,
          transactionIds: z.array(id),
          note: z.string().max(500),
        })
        .strict(),
    ),
    purchaseItems: z.array(
      z
        .object({
          ...meta,
          purchaseId: id,
          productId: id,
          shoppingItemId: id,
          quantityBase: quantity,
          packagesCount: z.number().int().min(1).max(10000),
          totalCents: cents,
          expiryDate: date.nullable(),
        })
        .strict(),
    ),
    catalogImports: z.array(
      z
        .object({
          ...meta,
          sourceType: z.literal("import"),
          sourceReference: name,
          importedAt: z.string().datetime(),
          checksum: z.string().regex(/^[a-f0-9]{64}$/),
          successCount: z.number().int().min(1),
          errorCount: z.literal(0),
        })
        .strict(),
    ),
  };
}
export function emptyShopping() {
  return {
    supermarkets: [],
    products: [],
    ingredientProductMappings: [],
    priceObservations: [],
    pantryLots: [],
    shoppingLists: [],
    shoppingItems: [],
    purchases: [],
    purchaseItems: [],
    catalogImports: [],
  };
}
