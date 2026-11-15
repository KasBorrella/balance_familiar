import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShoppingBasket, Package, Plus } from "lucide-react";
import { useFinance } from "@/app/context";
import { repository } from "@/db/repository";
import { today } from "@/domain/calendar";
import { money } from "@/domain/money";
import {
  latestPrice,
  listTotal,
  priceIsStale,
  reservedQuantity,
  staleDays,
} from "@/domain/shopping";
import { groupLabels, productGroups } from "@/domain/shopping-models";
import {
  Card,
  Empty,
  PageHeading,
  RowActions,
  SectionTitle,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { errorMessage } from "@/components/editor";
import { ShoppingEditor, type ShoppingEdit } from "./ShoppingEditor";
import { CatalogImport, downloadCatalogTemplate } from "./CatalogImport";
import { consumeList, refreshList } from "./service";

export function Shopping() {
  const { data, notify, remove } = useFinance();
  const [params, setParams] = useSearchParams(),
    [edit, setEdit] = useState<ShoppingEdit | null>(null);
  const [importing, setImporting] = useState(false),
    [consuming, setConsuming] = useState(false),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const [maxAge, setMaxAge] = useState(String(staleDays(data)));
  const tab = params.get("tab") || "listas";
  const list =
    data.shoppingLists.find((l) => l.id === params.get("lista")) ??
    [...data.shoppingLists].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    )[0];
  const items = data.shoppingItems.filter((i) => i.listId === list?.id),
    purchase = data.purchases.find((p) => p.listId === list?.id);
  const total = list ? listTotal(data, list.id) : 0;
  const prices = items.map((i) =>
    data.priceObservations.find((p) => p.id === i.priceObservationId)!,
  );
  const setTab = (tab: string) =>
    setParams({ tab, ...(list ? { lista: list.id } : {}) });
  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      notify(message);
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="meals-page shopping-page">
      <PageHeading
        eyebrow="SUPERMERCADO Y DESPENSA"
        title="La compra"
        description="Prepara la lista con lo que tienes en casa y apunta lo que gastas de verdad."
        action={
          <Link className="btn btn-secondary" to="/menus">
            Ver mis menús
          </Link>
        }
      />
      <div className="meal-hero">
        <div>
          <span className="eyebrow">MERCADONA · CATÁLOGO PROPIO</span>
          <h2>Qué falta en casa</h2>
          <p>
            Envases completos, precios con fecha y una despensa que cuenta para
            la próxima compra.
          </p>
        </div>
        <div className="meal-hero-stats">
          <ShoppingBasket />
          <strong>{data.products.filter((p) => p.active).length}</strong>
          <span>productos</span>
          <Package />
          <strong>
            {data.pantryLots.filter((l) => l.quantityBase > 0).length}
          </strong>
          <span>lotes</span>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Compra y despensa">
        {[
          ["listas", "Lista"],
          ["catalogo", "Catálogo"],
          ["despensa", "Despensa"],
          ["historial", "Compras"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "catalogo" && (
        <>
          <Card>
            <SectionTitle title="Productos y precios">
              <Button onClick={() => setEdit({ kind: "product" })}>
                <Plus size={17} />
                Añadir producto
              </Button>
            </SectionTitle>
            <p className="muted">
              Los precios los introduces tú o proceden de un archivo. No son
              precios en tiempo real. Vincula cada alimento a un ingrediente del
              menú y revisa su etiqueta antes de usarlo en una lista.
            </p>
            <div className="inline-actions">
              <Button variant="secondary" onClick={() => setImporting(true)}>
                Importar CSV o JSON
              </Button>
              <Button variant="ghost" onClick={downloadCatalogTemplate}>
                Descargar plantilla
              </Button>
            </div>
            <div className="shopping-settings">
              <label className="field">
                <span>Avisar de precios con más de estos días</span>
                <input
                  aria-label="Antigüedad máxima del precio"
                  type="number"
                  min={1}
                  max={365}
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const n = Number(maxAge);
                    if (!Number.isInteger(n) || n < 1 || n > 365)
                      throw new Error("Elige entre 1 y 365 días.");
                    await repository.setSetting("priceMaxAgeDays", n);
                  }, "Aviso de precios actualizado.")
                }
              >
                Guardar aviso
              </Button>
            </div>
            <label className="field">
              <span>Buscar producto</span>
              <input
                aria-label="Buscar producto"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </Card>
          {!data.products.length && (
            <Card>
              <Empty
                title="Añade los productos que compras"
                description="Empieza con los alimentos de tus recetas. Puedes guardar distintos formatos y dejar que la lista calcule la combinación más barata para cubrir la cantidad."
              />
            </Card>
          )}
          <div className="meal-recipe-grid">
            {data.products
              .filter((p) =>
                `${p.name} ${p.externalSku}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((p) => {
                const price = latestPrice(data, p.id, undefined, true),
                  mapping = data.ingredientProductMappings.find(
                    (m) => m.productId === p.id,
                  ),
                  ingredient = data.ingredients.find(
                    (i) => i.id === mapping?.ingredientId,
                  );
                return (
                  <Card key={p.id}>
                    <SectionTitle title={p.name}>
                      <RowActions
                        name={p.name}
                        edit={() => setEdit({ kind: "product", id: p.id })}
                      />
                    </SectionTitle>
                    <p>
                      {p.packageQuantity} {p.unit} · {groupLabels[p.group]} ·{" "}
                      {p.externalSku}
                      {!p.active && " · Archivado"}
                    </p>
                    <strong className="shopping-price">
                      {price ? money(price.priceCents) : "Sin precio"}
                    </strong>
                    {price && (
                      <p className="field-hint">
                        {price.observedAt} ·{" "}
                        {price.sourceType === "import"
                          ? "Importado, no verificado"
                          : price.sourceType === "demo"
                            ? "FICTICIO"
                            : "Anotado manualmente"}
                        <br />
                        {price.sourceReference} · {price.storeContext}
                      </p>
                    )}
                    {price && priceIsStale(data, price) && (
                      <p className="notice">
                        Precio antiguo: compruébalo antes de comprar.
                      </p>
                    )}
                    {p.variableWeight && (
                      <p className="notice">
                        Peso variable. El importe final se ajusta al registrar
                        el ticket.
                      </p>
                    )}
                    <p className="muted">
                      {p.labelChecked
                        ? "Etiqueta revisada"
                        : "Etiqueta pendiente de revisar"}{" "}
                      · Alérgenos:{" "}
                      {p.allergens.join(", ") || "ninguno declarado"}
                    </p>
                    {p.group === "food" && (
                      <>
                        <p>
                          {ingredient
                            ? `Equivale a ${mapping!.usableQuantity} ${ingredient.baseUnit} de ${ingredient.name}`
                            : "Todavía sin ingrediente equivalente"}
                        </p>
                        <Button
                          variant="secondary"
                          onClick={() => setEdit({ kind: "mapping", id: p.id })}
                        >
                          Vincular ingrediente
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            repository.save("products", {
                              ...p,
                              active: !p.active,
                              updatedAt: new Date().toISOString(),
                            }),
                          p.active
                            ? "Producto archivado."
                            : "Producto activado.",
                        )
                      }
                    >
                      {p.active ? "Archivar" : "Activar"}
                    </Button>
                    <details>
                      <summary>Historial de precios</summary>
                      {data.priceObservations
                        .filter((o) => o.productId === p.id)
                        .sort((a, b) =>
                          b.observedAt.localeCompare(a.observedAt),
                        )
                        .map((o) => (
                          <p key={o.id}>
                            {o.observedAt} · {money(o.priceCents)} ·{" "}
                            {o.sourceType === "demo"
                              ? "FICTICIO"
                              : o.sourceType === "import"
                                ? "Importado, no verificado"
                                : "Manual"}{" "}
                            · {o.sourceReference} · {o.storeContext}
                          </p>
                        ))}
                    </details>
                  </Card>
                );
              })}
          </div>
        </>
      )}
      {tab === "despensa" && (
        <Card>
          <SectionTitle title="Lo que queda en casa">
            <Button onClick={() => setEdit({ kind: "lot" })}>
              Añadir lote
            </Button>
          </SectionTitle>
          <p className="muted">
            Cada lote puede tener una caducidad distinta. Las listas reservan
            existencias; solo se descuentan cuando confirmas el consumo.
          </p>
          {!data.pantryLots.length && (
            <Empty
              title="La despensa está vacía"
              description="Añade lo que ya tienes o registra una compra. Necesitas crear antes los ingredientes desde Menús."
            />
          )}
          {data.pantryLots.map((l) => {
            const i = data.ingredients.find((i) => i.id === l.ingredientId)!,
              reserved = reservedQuantity(data, l.id);
            return (
              <div className="meal-record" key={l.id}>
                <div>
                  <strong>
                    {i.name} · {l.quantityBase.toLocaleString("es-ES")}{" "}
                    {i.baseUnit}
                  </strong>
                  <small>
                    {reserved} reservados ·{" "}
                    {l.expiryDate
                      ? `Caduca: ${l.expiryDate}`
                      : "Sin fecha de caducidad"}
                  </small>
                  {l.expiryDate &&
                    l.expiryDate < today() &&
                    l.quantityBase > 0 && (
                      <span className="field-error">
                        Caducado: no cuenta para las listas.
                      </span>
                    )}
                  {l.note && <small>{l.note}</small>}
                  <Button
                    variant="ghost"
                    disabled={l.quantityBase <= reserved}
                    onClick={() => setEdit({ kind: "use", id: l.id })}
                  >
                    Descontar cantidad
                  </Button>
                </div>
                <RowActions
                  name={`lote de ${i.name}`}
                  edit={() => setEdit({ kind: "lot", id: l.id })}
                  remove={() =>
                    remove("pantryLots", l.id, `el lote de ${i.name}`)
                  }
                />
              </div>
            );
          })}
        </Card>
      )}
      {tab === "listas" && (
        <>
          <Card>
            <SectionTitle title="Listas semanales">
              <Button onClick={() => setEdit({ kind: "list" })}>
                Preparar lista
              </Button>
            </SectionTitle>
            {!data.mealPlans.length && (
              <p>
                Añade un menú con comidas antes de preparar la lista.{" "}
                <Link to="/menus">Ir a Menús</Link>
              </p>
            )}
            {list ? (
              <label className="field">
                <span>Lista seleccionada</span>
                <select
                  aria-label="Lista seleccionada"
                  value={list.id}
                  onChange={(e) => setParams({ tab, lista: e.target.value })}
                >
                  {data.shoppingLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.startDate} — {l.endDate} ·{" "}
                      {l.status === "draft"
                        ? "Pendiente"
                        : l.status === "purchased"
                          ? "Comprada"
                          : "Consumo anotado"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                Prepara una lista para calcular lo que falta y los envases
                necesarios.
              </p>
            )}
          </Card>
          {list && (
            <>
              <Card>
                <div className="meal-summary">
                  <div>
                    <small>
                      Cesta estimada{list.warnings.length ? " parcial" : ""}
                    </small>
                    <strong>{money(total)}</strong>
                  </div>
                  <div>
                    <small>Límite de esta lista</small>
                    <strong>
                      {list.budgetCents === null
                        ? "Sin fijar"
                        : money(list.budgetCents)}
                    </strong>
                  </div>
                  <div>
                    <small>Ticket real</small>
                    <strong>
                      {purchase
                        ? money(purchase.actualTotalCents)
                        : "Sin registrar"}
                    </strong>
                  </div>
                  <div>
                    <small>Diferencia real − prevista</small>
                    <strong>
                      {purchase
                        ? money(purchase.actualTotalCents - total)
                        : "—"}
                    </strong>
                  </div>
                </div>
                {list.budgetCents !== null &&
                  Math.max(total, purchase?.actualTotalCents ?? 0) >
                    list.budgetCents && (
                    <p className="notice error" role="alert">
                      La compra supera el límite de esta lista.
                    </p>
                  )}
                {prices.some((p) => priceIsStale(data, p)) && (
                  <p className="notice">
                    Hay precios antiguos. El total es una estimación; comprueba
                    los importes en la tienda.
                  </p>
                )}
                {prices.some((p) => p.sourceType === "demo") && (
                  <p className="notice error">
                    Esta lista contiene precios FICTICIOS. No son precios reales
                    de Mercadona.
                  </p>
                )}
                {list.warnings.length > 0 && (
                  <div className="notice error" role="alert">
                    <strong>Lista incompleta</strong>
                    <ul>
                      {list.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    <p>
                      Corrige el catálogo y las equivalencias y pulsa Recalcular
                      lista.
                    </p>
                  </div>
                )}
                <p className="field-hint">
                  La lista conserva las cantidades y precios del momento en que
                  se preparó. Recalcula antes de comprar si cambias el menú, la
                  familia, las etiquetas o la despensa. No descuenta alimentos
                  todavía.
                </p>
                <div className="inline-actions">
                  {list.status === "draft" ? (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => refreshList(list.id),
                            "Lista recalculada con los datos actuales.",
                          )
                        }
                      >
                        Recalcular lista
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setEdit({ kind: "extra", id: list.id })}
                      >
                        Añadir higiene o limpieza
                      </Button>
                      <Button
                        disabled={busy || !!list.warnings.length}
                        onClick={() =>
                          setEdit({ kind: "receipt", id: list.id })
                        }
                      >
                        Registrar ticket
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          remove(
                            "shoppingLists",
                            list.id,
                            "esta lista pendiente",
                          )
                        }
                      >
                        Eliminar lista
                      </Button>
                    </>
                  ) : list.status === "purchased" ? (
                    <Button onClick={() => setConsuming(true)}>
                      Anotar consumo del menú
                    </Button>
                  ) : (
                    <p>El consumo ya está descontado de la despensa.</p>
                  )}
                </div>
              </Card>
              {productGroups.map((group) => (
                <Card key={group}>
                  <SectionTitle title={groupLabels[group]} />
                  <p className="shopping-price">
                    {money(
                      items
                        .filter((i) => i.group === group)
                        .reduce(
                          (s, i) =>
                            s + i.packagesCount * i.unitPriceSnapshotCents,
                          0,
                        ),
                    )}
                  </p>
                  {items
                    .filter((i) => i.group === group)
                    .map((i) => {
                      const p = data.priceObservations.find(
                        (p) => p.id === i.priceObservationId,
                      )!;
                      return (
                        <div className="meal-record" key={i.id}>
                          <div>
                            <strong>{i.productName}</strong>
                            <small>
                              {i.packagesCount} envases ×{" "}
                              {money(i.unitPriceSnapshotCents)} ·{" "}
                              {i.packagesCount * i.usableQuantity} {i.unit}{" "}
                              aprovechables
                            </small>
                            <small>
                              {p.observedAt} ·{" "}
                              {p.sourceType === "demo"
                                ? "FICTICIO"
                                : p.sourceType === "import"
                                  ? "Importado, no verificado"
                                  : "Manual"}{" "}
                              · {p.sourceReference} · {p.storeContext}
                            </small>
                            {i.variableWeight && (
                              <small>Peso variable: revisar ticket</small>
                            )}
                          </div>
                          <strong>
                            {money(i.packagesCount * i.unitPriceSnapshotCents)}
                          </strong>
                        </div>
                      );
                    })}
                  {!items.some((i) => i.group === group) && (
                    <p className="muted">No hay productos de este grupo.</p>
                  )}
                </Card>
              ))}
              <Card>
                <SectionTitle title="Cantidades del menú y despensa reservada" />
                {list.needs.map((n) => {
                  const i = data.ingredients.find(
                    (i) => i.id === n.ingredientId,
                  )!;
                  const reserved = list.reservations
                    .filter((r) =>
                      data.pantryLots.some(
                        (l) => l.id === r.lotId && l.ingredientId === i.id,
                      ),
                    )
                    .reduce((s, r) => s + r.quantityBase, 0);
                  return (
                    <p key={i.id}>
                      {i.name}: {n.quantityBase} {i.baseUnit} necesarios ·{" "}
                      {reserved} {i.baseUnit} de despensa
                    </p>
                  );
                })}
              </Card>
            </>
          )}
        </>
      )}
      {tab === "historial" && (
        <Card>
          <SectionTitle title="Compras registradas" />
          <p className="muted">
            Cada ticket conserva su coste real y sus líneas. Sus gastos ya están
            incluidos en Movimientos; no los registres otra vez.
          </p>
          {!data.purchases.length && (
            <p>Todavía no has registrado ninguna compra.</p>
          )}
          {[...data.purchases]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((p) => (
              <details key={p.id} className="shopping-history">
                <summary>
                  {p.date} · {money(p.actualTotalCents)} ·{" "}
                  {
                    data.purchaseItems.filter((i) => i.purchaseId === p.id)
                      .length
                  }{" "}
                  productos
                </summary>
                {data.purchaseItems
                  .filter((i) => i.purchaseId === p.id)
                  .map((i) => (
                    <p key={i.id}>
                      {
                        data.shoppingItems.find(
                          (s) => s.id === i.shoppingItemId,
                        )?.productName
                      }{" "}
                      · {i.packagesCount} envases · {money(i.totalCents)}
                    </p>
                  ))}
                {p.note && <p>{p.note}</p>}
                <p>
                  Previsto: {money(listTotal(data, p.listId))} · Diferencia:{" "}
                  {money(p.actualTotalCents - listTotal(data, p.listId))}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setParams({ tab: "listas", lista: p.listId })}
                >
                  Ver lista
                </Button>
                <Link className="btn btn-ghost" to="/movimientos">
                  Ver gastos registrados
                </Link>
              </details>
            ))}
        </Card>
      )}
      {edit && (
        <ShoppingEditor
          key={`${edit.kind}-${edit.id ?? "new"}`}
          request={edit}
          close={() => setEdit(null)}
          saved={(id) => setParams({ tab: "listas", lista: id })}
        />
      )}
      {importing && <CatalogImport close={() => setImporting(false)} />}
      {consuming && list && (
        <Modal
          title="¿Descontar las cantidades del menú?"
          description="Confirma cuando hayas consumido estos ingredientes. Se descontarán una sola vez y quedarán guardados los sobrantes."
          onClose={() => {
            if (!busy) setConsuming(false);
          }}
        >
          <div className="meal-form">
            <p>
              Se descontarán todas las cantidades de esta lista semanal. Si
              falta cantidad utilizable, no se modificará ningún lote.
            </p>
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setConsuming(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await consumeList(list.id);
                    setConsuming(false);
                  }, "Consumo anotado. Los sobrantes siguen en la despensa.")
                }
              >
                Confirmar consumo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
