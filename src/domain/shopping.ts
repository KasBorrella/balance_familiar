import { metadata, type Data, type Row } from "./models";
import { addDays, consolidateIngredients, entryReasons } from "./meals";
import { today } from "./calendar";

export function latestPrice(
  data: Data,
  productId: string,
  date = today(),
  allowDemo = false,
) {
  return data.priceObservations
    .filter(
      (p) =>
        p.productId === productId &&
        p.observedAt <= date &&
        (allowDemo || p.sourceType !== "demo"),
    )
    .sort(
      (a, b) =>
        b.observedAt.localeCompare(a.observedAt) ||
        b.createdAt.localeCompare(a.createdAt),
    )[0];
}
export function staleDays(data: Data) {
  const days = Number(
    data.settings.find((s) => s.key === "priceMaxAgeDays")?.value ?? 14,
  );
  return Number.isInteger(days) && days >= 1 && days <= 365 ? days : 14;
}
export function priceIsStale(
  data: Data,
  price: Row<"priceObservations">,
  date = today(),
) {
  return price.observedAt < addDays(date, -staleDays(data));
}
export function reservedQuantity(
  data: Data,
  lotId: string,
  exceptListId?: string,
) {
  return data.shoppingLists
    .filter((l) => l.id !== exceptListId && l.status !== "consumed")
    .flatMap((l) => l.reservations)
    .filter((r) => r.lotId === lotId)
    .reduce((s, r) => s + r.quantityBase, 0);
}
export type PackageOption = { id: string; quantity: number; cents: number };
export function choosePackages(required: number, options: PackageOption[]) {
  if (
    !Number.isSafeInteger(required) ||
    required < 0 ||
    options.some(
      (p) =>
        !Number.isSafeInteger(p.quantity) ||
        p.quantity < 1 ||
        !Number.isSafeInteger(p.cents) ||
        p.cents < 0,
    )
  )
    throw new Error("Cantidades o precios no válidos.");
  if (required === 0) return [];
  if (!options.length)
    throw new Error("No hay formatos con precio disponible.");
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const step = options.reduce(
    (n, p) => gcd(n, p.quantity),
    options[0].quantity,
  );
  const target = Math.ceil(required / step),
    limit = target + Math.max(...options.map((p) => p.quantity / step)) - 1;
  if (limit > 100000 || options.length > 100)
    throw new Error(
      "Demasiadas cantidades o formatos para calcular esta combinación. Reduce los formatos vinculados o divide la lista.",
    );
  const cost = new Float64Array(limit + 1).fill(Infinity),
    previous = new Int32Array(limit + 1).fill(-1);
  cost[0] = 0;
  for (let q = 1; q <= limit; q++)
    for (let i = 0; i < options.length; i++) {
      const before = q - options[i].quantity / step;
      if (before >= 0 && cost[before] + options[i].cents < cost[q]) {
        cost[q] = cost[before] + options[i].cents;
        previous[q] = i;
      }
    }
  let best = target;
  for (let q = target + 1; q <= limit; q++) if (cost[q] < cost[best]) best = q;
  if (!Number.isFinite(cost[best]))
    throw new Error("No se puede cubrir la cantidad con estos formatos.");
  const counts = new Map<string, number>();
  while (best > 0) {
    const p = options[previous[best]];
    if (!p) throw new Error("No se ha podido calcular la cesta.");
    counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    best -= p.quantity / step;
  }
  return [...counts].map(([id, count]) => ({ id, count }));
}
export function listTotal(data: Data, id: string) {
  return data.shoppingItems
    .filter((i) => i.listId === id)
    .reduce((sum, i) => sum + i.packagesCount * i.unitPriceSnapshotCents, 0);
}
export function prepareShopping(
  data: Data,
  planId: string,
  supermarketId: string,
  startDate: string,
  budgetCents: number | null,
  allowDemo = false,
  date = today(),
) {
  const plan = data.mealPlans.find((p) => p.id === planId);
  if (
    !plan ||
    !data.supermarkets.some((s) => s.id === supermarketId && s.enabled)
  )
    throw new Error("Selecciona un menú y un supermercado activo.");
  if (startDate < plan.startDate || startDate > plan.endDate)
    throw new Error("El primer día debe estar dentro del menú.");
  const endDate = [addDays(startDate, 6), plan.endDate].sort()[0];
  const entries = data.mealEntries.filter(
    (e) => e.mealPlanId === planId && e.date >= startDate && e.date <= endDate,
  );
  if (!entries.length)
    throw new Error("No hay comidas anotadas en esa semana.");
  if (
    data.shoppingLists.some((l) =>
      l.entryIds.some((id) => entries.some((e) => e.id === id)),
    )
  )
    throw new Error(
      "Ya hay una lista para alguna de estas comidas. Revisa la lista existente o elimina su borrador.",
    );
  if (entries.some((e) => entryReasons(data, plan, e).length))
    throw new Error("Revisa primero las restricciones de los platos del menú.");
  const list: Row<"shoppingLists"> = {
    ...metadata(),
    mealPlanId: planId,
    supermarketId,
    startDate,
    endDate,
    status: "draft",
    entryIds: entries.map((e) => e.id),
    needs: [],
    reservations: [],
    warnings: [],
    budgetCents,
    allowDemo,
  };
  const items: Row<"shoppingItems">[] = [];
  const restrictions = new Set(
    data.householdMembers
      .filter((m) => m.active)
      .flatMap((m) => m.restrictions),
  );
  for (const { ingredient, quantity } of consolidateIngredients(
    data,
    entries,
  )) {
    list.needs.push({ ingredientId: ingredient.id, quantityBase: quantity });
    let missing = quantity;
    // Conservative: reserve only lots valid through the last day, never assume an early expiry lasts all week.
    for (const lot of data.pantryLots
      .filter(
        (l) =>
          l.ingredientId === ingredient.id &&
          (!l.expiryDate ||
            (l.expiryDate >= endDate && l.expiryDate >= date)) &&
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
      )) {
      const available = lot.quantityBase - reservedQuantity(data, lot.id);
      const used = Math.min(missing, Math.max(0, available));
      if (used) {
        list.reservations.push({ lotId: lot.id, quantityBase: used });
        missing -= used;
      }
    }
    if (!missing) continue;
    const candidates = data.ingredientProductMappings
      .filter((m) => m.ingredientId === ingredient.id)
      .flatMap((mapping) => {
        const product = data.products.find(
          (p) =>
            p.id === mapping.productId &&
            p.supermarketId === supermarketId &&
            p.active &&
            p.group === "food",
        );
        if (
          !product ||
          !product.labelChecked ||
          product.allergens.some((a) => restrictions.has(a))
        )
          return [];
        const price = latestPrice(data, product.id, date, allowDemo);
        return price ? [{ mapping, product, price }] : [];
      });
    if (!candidates.length) {
      list.warnings.push(
        `${ingredient.name}: faltan ${missing} ${ingredient.baseUnit}; revisa equivalencias, etiquetas, alergias y precios.`,
      );
      continue;
    }
    const combination = choosePackages(
      missing,
      candidates.map((c) => ({
        id: c.product.id,
        quantity: c.mapping.usableQuantity,
        cents: c.price.priceCents,
      })),
    );
    for (const { id, count } of combination) {
      const { product, mapping, price } = candidates.find(
        (c) => c.product.id === id,
      )!;
      items.push({
        ...metadata(),
        listId: list.id,
        productId: id,
        ingredientId: ingredient.id,
        packagesCount: count,
        usableQuantity: mapping.usableQuantity,
        unit: ingredient.baseUnit,
        group: product.group,
        productName: product.name,
        unitPriceSnapshotCents: price.priceCents,
        priceObservationId: price.id,
        variableWeight: product.variableWeight,
      });
    }
  }
  return { list, items };
}
export function validateShopping(data: Data) {
  function assert(ok: unknown, message: string): asserts ok {
    if (!ok) throw new Error(message);
  }
  const unique = (values: string[], message: string) =>
    assert(new Set(values).size === values.length, message);
  const ingredient = (id: string) => data.ingredients.find((i) => i.id === id);
  const product = (id: string) => data.products.find((p) => p.id === id);
  unique(
    data.products.map((p) => `${p.supermarketId}/${p.externalSku}`),
    "Hay referencias de producto duplicadas.",
  );
  unique(
    data.ingredientProductMappings.map((m) => m.productId),
    "Un producto solo puede equivaler a un ingrediente; así no se cuenta dos veces.",
  );
  for (const p of data.products)
    assert(
      data.supermarkets.some((s) => s.id === p.supermarketId),
      "El supermercado del producto no existe.",
    );
  for (const m of data.ingredientProductMappings) {
    const p = product(m.productId),
      i = ingredient(m.ingredientId);
    assert(
      p && i && p.group === "food",
      "La equivalencia necesita un ingrediente y un producto alimentario.",
    );
    assert(
      p.unit === i.baseUnit && m.usableQuantity <= p.packageQuantity,
      "La equivalencia debe usar la misma unidad y no superar el contenido del envase.",
    );
  }
  for (const p of data.priceObservations) {
    assert(product(p.productId), "El producto del precio no existe.");
    assert(
      p.observedAt <= today(),
      "La fecha del precio no puede estar en el futuro.",
    );
    assert(
      (p.sourceType === "demo") === (p.verificationStatus === "demo"),
      "El precio de ejemplo debe estar identificado como ficticio.",
    );
  }
  for (const lot of data.pantryLots) {
    assert(
      ingredient(lot.ingredientId),
      "El ingrediente de la despensa no existe.",
    );
    assert(
      !lot.productId || product(lot.productId),
      "El producto de la despensa no existe.",
    );
    assert(
      !lot.purchaseId || data.purchases.some((p) => p.id === lot.purchaseId),
      "La compra del lote no existe.",
    );
    assert(
      lot.quantityBase >= reservedQuantity(data, lot.id),
      "Ese lote tiene cantidades reservadas en listas pendientes.",
    );
  }
  unique(
    data.shoppingLists.flatMap((l) => l.entryIds),
    "Una comida ya está incluida en otra lista de compra.",
  );
  for (const list of data.shoppingLists) {
    assert(
      data.mealPlans.some((p) => p.id === list.mealPlanId) &&
        data.supermarkets.some((s) => s.id === list.supermarketId),
      "El menú o supermercado de la lista no existe.",
    );
    assert(
      list.endDate >= list.startDate &&
        list.endDate <= addDays(list.startDate, 6),
      "La lista debe cubrir como máximo siete días.",
    );
    unique(
      list.needs.map((n) => n.ingredientId),
      "Necesidades de ingredientes duplicadas.",
    );
    unique(
      list.reservations.map((r) => r.lotId),
      "Reservas de despensa duplicadas.",
    );
    for (const n of list.needs)
      assert(
        ingredient(n.ingredientId),
        "El ingrediente de la lista no existe.",
      );
    for (const r of list.reservations)
      assert(
        data.pantryLots.some(
          (l) =>
            l.id === r.lotId &&
            list.needs.some((n) => n.ingredientId === l.ingredientId) &&
            (list.status === "consumed" ||
              !l.expiryDate ||
              l.expiryDate >= list.endDate),
        ),
        "El lote reservado no existe, ha cambiado de ingrediente o caduca antes de terminar el menú. Recalcula o elimina la lista pendiente antes de cambiarlo.",
      );
    const purchase = data.purchases.find((p) => p.listId === list.id);
    assert(
      list.status === "draft" ? !purchase : !!purchase,
      "El estado de la lista no coincide con la compra.",
    );
  }
  unique(
    data.shoppingItems.map((i) => `${i.listId}/${i.productId}`),
    "Producto repetido en la lista.",
  );
  for (const i of data.shoppingItems) {
    assert(
      data.shoppingLists.some((l) => l.id === i.listId) && product(i.productId),
      "La lista o el producto no existe.",
    );
    assert(
      !i.ingredientId || ingredient(i.ingredientId),
      "El ingrediente de la línea no existe.",
    );
    assert(
      data.priceObservations.some(
        (p) => p.id === i.priceObservationId && p.productId === i.productId,
      ),
      "Falta el precio original de la línea.",
    );
  }
  unique(
    data.purchases.map((p) => p.listId),
    "La compra ya está registrada.",
  );
  unique(
    data.purchaseItems.map((i) => i.shoppingItemId),
    "Línea de compra repetida.",
  );
  unique(
    data.purchases.flatMap((p) => p.transactionIds),
    "Un movimiento no puede pertenecer a dos tickets.",
  );
  for (const p of data.purchases) {
    assert(
      p.date <= today(),
      "La fecha del ticket no puede estar en el futuro.",
    );
    assert(
      data.shoppingLists.some((l) => l.id === p.listId && l.status !== "draft"),
      "La lista de la compra no existe o sigue en borrador.",
    );
    const lines = data.purchaseItems.filter((i) => i.purchaseId === p.id);
    assert(
      lines.reduce((s, i) => s + i.totalCents, 0) === p.actualTotalCents,
      "El total del ticket no coincide con sus líneas.",
    );
    const transactions = p.transactionIds.map((id) =>
      data.transactions.find((t) => t.id === id),
    );
    unique(p.transactionIds, "Movimientos del ticket duplicados.");
    assert(
      transactions.every(
        (t) => t && t.direction === "expense" && t.date === p.date,
      ) &&
        transactions.reduce((s, t) => s + (t?.amountCents ?? 0), 0) ===
          p.actualTotalCents,
      "El gasto registrado debe coincidir con el ticket. Los tickets se conservan para no desajustar la despensa.",
    );
  }
  for (const i of data.purchaseItems) {
    const p = data.purchases.find((p) => p.id === i.purchaseId);
    assert(
      p &&
        data.shoppingItems.some(
          (s) =>
            s.id === i.shoppingItemId &&
            s.listId === p.listId &&
            s.productId === i.productId,
        ),
      "La línea del ticket no corresponde a la lista.",
    );
  }
}
