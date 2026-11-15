import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useFinance } from "@/app/context";
import { repository } from "@/db/repository";
import { metadata } from "@/domain/models";
import { groupLabels, productGroups } from "@/domain/shopping-models";
import { latestPrice, reservedQuantity } from "@/domain/shopping";
import { today } from "@/domain/calendar";
import { money, moneyInput, parseMoney } from "@/domain/money";
import { allergens } from "@/domain/meal-models";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/components/editor";
import {
  addExtra,
  confirmPurchase,
  createShoppingList,
  saveCatalogRows,
  consumePantry,
} from "./service";
import type { CatalogRow } from "@/integrations/catalog";

export type ShoppingEdit = {
  kind: "product" | "mapping" | "lot" | "use" | "list" | "extra" | "receipt";
  id?: string;
};
export function ShoppingEditor({
  request,
  close,
  saved,
}: {
  request: ShoppingEdit;
  close: () => void;
  saved: (id: string) => void;
}) {
  const { data, notify } = useFinance();
  const product = data.products.find((p) => p.id === request.id),
    price = product && latestPrice(data, product.id, undefined, true);
  const mapping = data.ingredientProductMappings.find(
    (m) => m.productId === product?.id,
  );
  const lot = data.pantryLots.find((l) => l.id === request.id);
  const list = data.shoppingLists.find((l) => l.id === request.id);
  const items = data.shoppingItems.filter((i) => i.listId === list?.id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { register, handleSubmit, watch } = useForm<Record<string, string>>({
    defaultValues: {
      sku: product?.externalSku ?? "",
      name: product?.name ?? "",
      packageQuantity: String(product?.packageQuantity ?? 1000),
      unit: product?.unit ?? "g",
      group: product?.group ?? "food",
      price: price ? moneyInput(price.priceCents) : "",
      observedAt: price?.observedAt ?? today(),
      sourceReference: price?.sourceReference ?? "Etiqueta de la tienda",
      storeContext: price?.storeContext ?? "",
      variableWeight: product?.variableWeight ? "true" : "false",
      allergens: product?.allergens.join("|") ?? "",
      labelChecked: product?.labelChecked ? "true" : "false",
      ingredientId: mapping?.ingredientId ?? lot?.ingredientId ?? "",
      usableQuantity: String(
        mapping?.usableQuantity ?? product?.packageQuantity ?? 1000,
      ),
      quantityBase: String(lot?.quantityBase ?? 1000),
      expiryDate: lot?.expiryDate ?? "",
      note: lot?.note ?? "",
      used: "1",
      mealPlanId: data.mealPlans[0]?.id ?? "",
      startDate: data.mealPlans[0]?.startDate ?? today(),
      budget: "",
      allowDemo: "false",
      productId: "",
      packagesCount: "1",
      date: today(),
      ...Object.fromEntries(
        items.flatMap((i) => [
          [`count_${i.id}`, String(i.packagesCount)],
          [`quantity_${i.id}`, String(i.packagesCount * i.usableQuantity)],
          [
            `total_${i.id}`,
            moneyInput(i.packagesCount * i.unitPriceSnapshotCents),
          ],
          [`expiry_${i.id}`, ""],
        ]),
      ),
    },
  });
  const field = (
    key: string,
    label: string,
    type = "text",
    props: Record<string, string | boolean | number> = {},
  ) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input
        {...register(key)}
        aria-label={label}
        type={type}
        required
        {...props}
      />
    </label>
  );
  const select = (key: string, label: string, options: [string, string][]) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <select {...register(key)} aria-label={label} required>
        {options.map(([id, text]) => (
          <option value={id} key={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  let content: ReactNode;
  if (request.kind === "product")
    content = (
      <>
        <div className="form-grid">
          {field("sku", "Referencia del producto", "text", {
            readOnly: !!product,
            maxLength: 160,
          })}
          {field("name", "Nombre del producto", "text", { maxLength: 160 })}
          {field("packageQuantity", "Contenido de un envase", "number", {
            min: 1,
            max: 10000000,
          })}
          {select("unit", "Unidad", [
            ["g", "Gramos"],
            ["ml", "Mililitros"],
            ["ud", "Unidades"],
          ])}
          {select(
            "group",
            "Grupo",
            productGroups.map((g) => [g, groupLabels[g]]),
          )}
          {select("variableWeight", "Peso variable", [
            ["false", "No"],
            ["true", "Sí, comprobar el peso del ticket"],
          ])}
          {field("price", "Precio por envase (€)", "text", {
            inputMode: "decimal",
          })}
          {field("observedAt", "Fecha del precio", "date", { max: today() })}
          {field("sourceReference", "Procedencia del precio", "text", {
            maxLength: 160,
          })}
          {field("storeContext", "Tienda o zona", "text", { maxLength: 160 })}
        </div>
        {select("labelChecked", "He revisado los ingredientes y la etiqueta", [
          ["false", "No todavía"],
          ["true", "Sí"],
        ])}
        {field("allergens", "Alérgenos declarados (separados por |)", "text", {
          required: false,
        })}
        <p className="field-hint">
          Valores admitidos: {allergens.join(", ")}. La lista automática solo
          utiliza productos con la etiqueta revisada. El precio que guardes será
          una nueva observación manual; no se borrará el anterior.
        </p>
      </>
    );
  else if (request.kind === "mapping")
    content = (
      <>
        <p>
          {product?.name} · {product?.packageQuantity} {product?.unit} por
          envase
        </p>
        {select("ingredientId", "Ingrediente equivalente", [
          ["", "Elegir ingrediente"],
          ...data.ingredients
            .filter((i) => i.baseUnit === product?.unit)
            .map((i) => [i.id, i.name] as [string, string]),
        ])}
        {field("usableQuantity", "Cantidad aprovechable por envase", "number", {
          min: 1,
          max: product?.packageQuantity ?? 10000000,
        })}
        <p className="field-hint">
          En {product?.unit}. Por ejemplo, el peso escurrido de un bote. Solo se
          admiten equivalencias con la misma unidad; no se convierte entre
          gramos y mililitros.
        </p>
      </>
    );
  else if (request.kind === "lot")
    content = (
      <>
        {select("ingredientId", "Ingrediente del lote", [
          ["", "Elegir ingrediente"],
          ...data.ingredients.map(
            (i) => [i.id, `${i.name} (${i.baseUnit})`] as [string, string],
          ),
        ])}
        {field("quantityBase", "Cantidad que queda", "number", {
          min: 0,
          max: 10000000,
        })}
        {field("expiryDate", "Fecha de caducidad", "date", { required: false })}
        {field("note", "Nota del lote", "text", {
          required: false,
          maxLength: 300,
        })}
        <p className="field-hint">
          La cantidad se expresa en la unidad del ingrediente. Sin fecha, la app
          no puede avisarte de su caducidad.
        </p>
      </>
    );
  else if (request.kind === "use")
    content = (
      <>
        <p>
          {data.ingredients.find((i) => i.id === lot?.ingredientId)?.name}:{" "}
          {lot ? lot.quantityBase - reservedQuantity(data, lot.id) : 0} libres.
          Lo reservado para listas pendientes no se puede descontar aquí.
        </p>
        {field("used", "Cantidad consumida o descartada", "number", {
          min: 1,
          max: 10000000,
        })}
      </>
    );
  else if (request.kind === "list")
    content = (
      <>
        {select("mealPlanId", "Menú de la compra", [
          ["", "Elegir menú"],
          ...data.mealPlans.map(
            (p) => [p.id, `${p.startDate} — ${p.endDate}`] as [string, string],
          ),
        ])}
        {field("startDate", "Primer día de esta compra", "date")}
        {field("budget", "Límite para esta lista (€)", "text", {
          required: false,
          inputMode: "decimal",
        })}
        {select("allowDemo", "Permitir precios ficticios", [
          ["false", "No"],
          ["true", "Sí, solo para probar"],
        ])}
        <p className="field-hint">
          La lista cubre hasta siete días. Se reserva despensa válida hasta el
          último día; los lotes que caduquen antes se dejan fuera por prudencia.
          Las cantidades no se descuentan todavía.
        </p>
      </>
    );
  else if (request.kind === "extra")
    content = (
      <>
        {select("productId", "Producto de higiene o limpieza", [
          ["", "Elegir producto"],
          ...data.products
            .filter((p) => p.active && p.group !== "food")
            .map(
              (p) =>
                [p.id, `${p.name} · ${groupLabels[p.group]}`] as [
                  string,
                  string,
                ],
            ),
        ])}
        {field("packagesCount", "Número de envases", "number", {
          min: 1,
          max: 10000,
        })}
      </>
    );
  else
    content = (
      <>
        {field("date", "Fecha del ticket", "date", { max: today() })}
        <p>
          Revisa los importes reales y las cantidades aprovechables de todos los
          envases. El ticket se guardará una vez y los alimentos se añadirán a
          la despensa.
        </p>
        {items.map((i) => (
          <fieldset className="meal-lines" key={i.id}>
            <legend>{i.productName}</legend>
            <div className="form-grid">
              {field(`count_${i.id}`, `Envases de ${i.productName}`, "number", {
                min: 1,
                max: 10000,
              })}
              {field(
                `quantity_${i.id}`,
                `Cantidad total de ${i.productName} (${i.unit})`,
                "number",
                { min: 1, max: 10000000 },
              )}
              {field(
                `total_${i.id}`,
                `Importe de ${i.productName} (€)`,
                "text",
                { inputMode: "decimal" },
              )}
              {i.ingredientId &&
                field(
                  `expiry_${i.id}`,
                  `Caducidad de ${i.productName}`,
                  "date",
                  { required: false },
                )}
            </div>
            {i.variableWeight && (
              <p className="notice">
                Producto de peso variable: introduce el peso y el importe del
                ticket.
              </p>
            )}
          </fieldset>
        ))}
        {productGroups
          .filter((g) => items.some((i) => i.group === g))
          .map((g) =>
            select(`category_${g}`, `Categoría de gasto: ${groupLabels[g]}`, [
              ["", "Elegir categoría"],
              ...data.categories
                .filter((c) => c.type === "expense" && !c.archivedAt)
                .map((c) => [c.id, c.name] as [string, string]),
            ]),
          )}
        {field("note", "Nota del ticket", "text", {
          required: false,
          maxLength: 500,
        })}
        <p className="notice">
          Total del ticket:{" "}
          {(() => {
            try {
              return money(
                items.reduce(
                  (s, i) => s + parseMoney(watch(`total_${i.id}`) || "0"),
                  0,
                ),
              );
            } catch {
              return "Revisa los importes";
            }
          })()}
          . Se registrará un gasto por grupo, sin añadir otro gasto con el
          total. El ticket confirmado se conservará en el historial.
        </p>
        {!items.length && (
          <p>
            Todo está cubierto por la despensa: se registrará una compra de 0 €
            sin movimientos financieros.
          </p>
        )}
      </>
    );
  const titles = {
    product: "Producto y precio",
    mapping: "Vincular ingrediente",
    lot: "Lote de despensa",
    use: "Descontar del lote",
    list: "Preparar lista semanal",
    extra: "Añadir a la lista",
    receipt: "Registrar ticket",
  };
  return (
    <Modal
      title={titles[request.kind]}
      description="Datos guardados en este dispositivo."
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form
        className="meal-form"
        onSubmit={handleSubmit(async (v) => {
          setBusy(true);
          setError("");
          try {
            if (request.kind === "product")
              await saveCatalogRows(
                [
                  {
                    sku: v.sku,
                    name: v.name,
                    packageQuantity: Number(v.packageQuantity),
                    unit: v.unit as CatalogRow["unit"],
                    group: v.group as CatalogRow["group"],
                    priceCents: parseMoney(v.price),
                    observedAt: v.observedAt,
                    sourceReference: v.sourceReference,
                    storeContext: v.storeContext,
                    variableWeight: v.variableWeight === "true",
                    labelChecked: v.labelChecked === "true",
                    allergens: v.allergens
                      .split("|")
                      .map((a) => a.trim())
                      .filter(Boolean) as CatalogRow["allergens"],
                  },
                ],
                "manual",
                v.sourceReference,
              );
            if (request.kind === "mapping" && product)
              await repository.save("ingredientProductMappings", {
                ...(mapping ?? metadata()),
                updatedAt: new Date().toISOString(),
                ingredientId: v.ingredientId,
                productId: product.id,
                usableQuantity: Number(v.usableQuantity),
              });
            if (request.kind === "lot")
              await repository.save("pantryLots", {
                ...(lot ?? metadata()),
                updatedAt: new Date().toISOString(),
                ingredientId: v.ingredientId,
                productId: lot?.productId ?? null,
                purchaseId: lot?.purchaseId ?? null,
                quantityBase: Number(v.quantityBase),
                expiryDate: v.expiryDate || null,
                note: v.note,
              });
            if (request.kind === "use" && lot)
              await consumePantry(lot.id, Number(v.used));
            if (request.kind === "list")
              saved(
                await createShoppingList(
                  v.mealPlanId,
                  v.startDate,
                  v.budget.trim() ? parseMoney(v.budget) : null,
                  v.allowDemo === "true",
                ),
              );
            if (request.kind === "extra" && list)
              await addExtra(list.id, v.productId, Number(v.packagesCount));
            if (request.kind === "receipt" && list)
              await confirmPurchase(
                list.id,
                v.date,
                items.map((i) => ({
                  shoppingItemId: i.id,
                  packagesCount: Number(v[`count_${i.id}`]),
                  quantityBase: Number(v[`quantity_${i.id}`]),
                  totalCents: parseMoney(v[`total_${i.id}`]),
                  expiryDate: v[`expiry_${i.id}`] || null,
                })),
                Object.fromEntries(
                  productGroups.map((g) => [g, v[`category_${g}`]]),
                ),
                v.note,
              );
            notify("Cambios guardados.");
            close();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        })}
      >
        {content}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? "Guardando…"
              : request.kind === "receipt"
                ? "Confirmar compra y registrar gasto"
                : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
