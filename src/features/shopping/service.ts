import { repository, type DexieFinanceRepository } from "@/db/repository";
import { today } from "@/domain/calendar";
import { groupLabels } from "@/domain/shopping-models";
import { metadata, type Data, type Row } from "@/domain/models";
import {
  latestPrice,
  prepareShopping,
  reservedQuantity,
} from "@/domain/shopping";
import { productGroups } from "@/domain/shopping-models";
import { catalogRowSchema, type CatalogRow } from "@/integrations/catalog";
import { checksum } from "@/features/backup/service";

function ensureStore(data: Data) {
  let store = data.supermarkets.find((s) => s.name === "Mercadona");
  if (!store) {
    store = { ...metadata(), name: "Mercadona", enabled: true };
    data.supermarkets.push(store);
  }
  return store;
}
export async function saveCatalogRows(
  rows: CatalogRow[],
  source: "manual" | "import",
  sourceReference: string,
  repo: DexieFinanceRepository = repository,
) {
  if (!rows.length || rows.length > 5000)
    throw new Error("El catálogo está vacío o supera 5.000 productos.");
  const checked = rows.map((r) => catalogRowSchema.parse(r));
  if (new Set(checked.map((r) => r.sku)).size !== checked.length)
    throw new Error("Hay referencias repetidas.");
  const hash = await checksum(checked);
  await repo.mutate((data) => {
    if (
      source === "import" &&
      data.catalogImports.some((i) => i.checksum === hash)
    )
      throw new Error("Este catálogo ya se ha importado.");
    const store = ensureStore(data);
    for (const r of checked) {
      const old = data.products.find(
        (p) => p.supermarketId === store.id && p.externalSku === r.sku,
      );
      if (
        old &&
        (old.unit !== r.unit ||
          old.packageQuantity !== r.packageQuantity ||
          old.group !== r.group) &&
        (data.ingredientProductMappings.some((m) => m.productId === old.id) ||
          data.shoppingItems.some((i) => i.productId === old.id) ||
          data.pantryLots.some((l) => l.productId === old.id))
      )
        throw new Error(
          `${r.name}: usa otra referencia para cambiar el formato de un producto que ya está en uso.`,
        );
      const product: Row<"products"> = {
        ...(old ?? metadata()),
        updatedAt: new Date().toISOString(),
        supermarketId: store.id,
        externalSku: r.sku,
        name: r.name,
        packageQuantity: r.packageQuantity,
        unit: r.unit,
        group: r.group,
        variableWeight: r.variableWeight,
        active: old?.active ?? true,
        allergens: r.allergens,
        labelChecked: r.labelChecked,
      };
      data.products = [
        ...data.products.filter((p) => p.id !== product.id),
        product,
      ];
      data.priceObservations.push({
        ...metadata(),
        productId: product.id,
        priceCents: r.priceCents,
        currency: "EUR",
        observedAt: r.observedAt,
        sourceType: source,
        sourceReference: r.sourceReference,
        storeContext: r.storeContext,
        verificationStatus: source === "manual" ? "user_checked" : "unverified",
      });
    }
    if (source === "import")
      data.catalogImports.push({
        ...metadata(),
        sourceType: "import",
        sourceReference,
        importedAt: new Date().toISOString(),
        checksum: hash,
        successCount: checked.length,
        errorCount: 0,
      });
  });
}
export async function createShoppingList(
  planId: string,
  start: string,
  budget: number | null,
  allowDemo: boolean,
  repo = repository,
) {
  let id = "";
  await repo.mutate((data) => {
    const store = ensureStore(data),
      result = prepareShopping(
        data,
        planId,
        store.id,
        start,
        budget,
        allowDemo,
      );
    id = result.list.id;
    data.shoppingLists.push(result.list);
    data.shoppingItems.push(...result.items);
  });
  return id;
}
export async function addExtra(
  listId: string,
  productId: string,
  count: number,
  repo = repository,
) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
    throw new Error("Introduce entre 1 y 10.000 envases.");
  await repo.mutate((data) => {
    const list = data.shoppingLists.find(
        (l) => l.id === listId && l.status === "draft",
      ),
      product = data.products.find((p) => p.id === productId && p.active);
    if (
      !list ||
      !product ||
      product.supermarketId !== list.supermarketId ||
      product.group === "food"
    )
      throw new Error(
        "Selecciona un producto de higiene o limpieza y una lista pendiente.",
      );
    const price = latestPrice(data, product.id, undefined, list.allowDemo);
    if (!price) throw new Error("El producto no tiene un precio disponible.");
    const existing = data.shoppingItems.find(
      (i) => i.listId === listId && i.productId === productId,
    );
    if (existing) {
      existing.packagesCount += count;
      return;
    }
    data.shoppingItems.push({
      ...metadata(),
      listId,
      productId,
      ingredientId: null,
      packagesCount: count,
      usableQuantity: product.packageQuantity,
      unit: product.unit,
      group: product.group,
      productName: product.name,
      unitPriceSnapshotCents: price.priceCents,
      priceObservationId: price.id,
      variableWeight: product.variableWeight,
    });
  });
}
export async function refreshList(listId: string, repo = repository) {
  await repo.mutate((data) => {
    const old = data.shoppingLists.find(
      (l) => l.id === listId && l.status === "draft",
    );
    if (!old) throw new Error("Solo se recalculan listas pendientes.");
    const extras = data.shoppingItems.filter(
      (i) => i.listId === listId && i.group !== "food",
    );
    data.shoppingLists = data.shoppingLists.filter((l) => l.id !== listId);
    data.shoppingItems = data.shoppingItems.filter((i) => i.listId !== listId);
    const result = prepareShopping(
      data,
      old.mealPlanId,
      old.supermarketId,
      old.startDate,
      old.budgetCents,
      old.allowDemo,
    );
    data.shoppingLists.push({
      ...result.list,
      id: old.id,
      createdAt: old.createdAt,
    });
    data.shoppingItems.push(
      ...result.items.map((i) => ({ ...i, listId })),
      ...extras,
    );
  });
}
export type ReceiptLine = {
  shoppingItemId: string;
  packagesCount: number;
  quantityBase: number;
  totalCents: number;
  expiryDate: string | null;
};
export async function confirmPurchase(
  listId: string,
  date: string,
  lines: ReceiptLine[],
  categories: Record<string, string>,
  note: string,
  repo = repository,
) {
  await repo.mutate((data) => {
    const list = data.shoppingLists.find((l) => l.id === listId);
    if (!list || list.status !== "draft")
      throw new Error("Esta compra ya está registrada o la lista no existe.");
    if (list.warnings.length)
      throw new Error(
        "Completa las equivalencias y precios y vuelve a crear la lista antes de registrar la compra.",
      );
    const items = data.shoppingItems.filter((i) => i.listId === listId);
    const restrictions = new Set(
      data.householdMembers
        .filter((m) => m.active)
        .flatMap((m) => m.restrictions),
    );
    if (
      items.some(
        (i) =>
          i.group === "food" &&
          !data.products.some(
            (p) =>
              p.id === i.productId &&
              p.labelChecked &&
              !p.allergens.some((a) => restrictions.has(a)),
          ),
      )
    )
      throw new Error(
        "Revisa las etiquetas y alergias actuales y recalcula la lista antes de comprar.",
      );
    if (
      new Set(lines.map((l) => l.shoppingItemId)).size !== lines.length ||
      lines.length !== items.length ||
      items.some((i) => !lines.some((l) => l.shoppingItemId === i.id))
    )
      throw new Error(
        "El ticket debe contener exactamente las líneas de la lista.",
      );
    const purchase: Row<"purchases"> = {
      ...metadata(),
      listId,
      date,
      actualTotalCents: lines.reduce((s, l) => s + l.totalCents, 0),
      transactionIds: [],
      note,
    };
    for (const group of productGroups) {
      const amount = lines
        .filter(
          (l) => items.find((i) => i.id === l.shoppingItemId)!.group === group,
        )
        .reduce((s, l) => s + l.totalCents, 0);
      if (!amount) continue;
      const category = data.categories.find(
        (c) =>
          c.id === categories[group] && c.type === "expense" && !c.archivedAt,
      );
      if (!category)
        throw new Error(
          `Elige una categoría de gasto para ${groupLabels[group].toLowerCase()}.`,
        );
      const transaction: Row<"transactions"> = {
        ...metadata(),
        date,
        direction: "expense",
        amountCents: amount,
        categoryId: category.id,
        expenseRuleId: null,
        incomeRuleId: null,
        occurrenceDate: null,
        expenseKind: "variable",
        fundId: null,
        goalId: null,
        memo: `Compra Mercadona · ${group === "food" ? "alimentación" : group === "hygiene" ? "higiene" : "limpieza"}`,
        source: "manual",
      };
      data.transactions.push(transaction);
      purchase.transactionIds.push(transaction.id);
    }
    data.purchases.push(purchase);
    list.status = "purchased";
    list.updatedAt = new Date().toISOString();
    for (const line of lines) {
      const item = items.find((i) => i.id === line.shoppingItemId)!;
      data.purchaseItems.push({
        ...metadata(),
        purchaseId: purchase.id,
        productId: item.productId,
        ...line,
      });
      if (item.ingredientId)
        data.pantryLots.push({
          ...metadata(),
          ingredientId: item.ingredientId,
          productId: item.productId,
          quantityBase: line.quantityBase,
          expiryDate: line.expiryDate,
          purchaseId: purchase.id,
          note: `Compra del ${date}`,
        });
    }
  });
}
export async function consumeList(listId: string, repo = repository) {
  await repo.mutate((data) => {
    const list = data.shoppingLists.find((l) => l.id === listId);
    if (!list || list.status !== "purchased")
      throw new Error(
        "Registra la compra antes de descontar; cada menú solo se descuenta una vez.",
      );
    for (const need of list.needs) {
      let remaining = need.quantityBase;
      const restrictions = new Set(
        data.householdMembers
          .filter((m) => m.active)
          .flatMap((m) => m.restrictions),
      );
      const ingredient = data.ingredients.find(
        (i) => i.id === need.ingredientId,
      )!;
      if (ingredient.allergens.some((a) => restrictions.has(a)))
        throw new Error(
          "Han cambiado las restricciones de la familia. Revisa el menú antes de anotar el consumo.",
        );
      const lots = data.pantryLots
        .filter(
          (l) =>
            l.ingredientId === need.ingredientId &&
            (!l.expiryDate ||
              (l.expiryDate >= list.endDate && l.expiryDate >= today())) &&
            (!l.productId ||
              data.products.some(
                (p) =>
                  p.id === l.productId &&
                  p.labelChecked &&
                  !p.allergens.some((a) => restrictions.has(a)),
              )),
        )
        .sort((a, b) =>
          (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999"),
        );
      for (const lot of lots) {
        const amount = Math.min(
          remaining,
          lot.quantityBase - reservedQuantity(data, lot.id, list.id),
        );
        if (amount > 0) {
          lot.quantityBase -= amount;
          remaining -= amount;
          lot.updatedAt = new Date().toISOString();
        }
      }
      if (remaining > 0)
        throw new Error(
          `Falta cantidad utilizable de ${data.ingredients.find((i) => i.id === need.ingredientId)?.name}. Revisa el peso real y las caducidades en Despensa.`,
        );
    }
    list.status = "consumed";
    list.updatedAt = new Date().toISOString();
  });
}
export async function consumePantry(
  lotId: string,
  quantity: number,
  repo = repository,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error("Introduce una cantidad entera mayor que cero.");
  await repo.mutate((data) => {
    const lot = data.pantryLots.find((l) => l.id === lotId);
    if (!lot || lot.quantityBase - reservedQuantity(data, lot.id) < quantity)
      throw new Error("No hay suficiente cantidad libre en ese lote.");
    lot.quantityBase -= quantity;
    lot.updatedAt = new Date().toISOString();
  });
}
