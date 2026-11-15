import { useState } from "react";
import { useFinance } from "@/app/context";
import {
  catalogFields,
  catalogLabels,
  parseCatalog,
  validateCatalog,
  type CatalogInput,
} from "@/integrations/catalog";
import { today } from "@/domain/calendar";
import { money } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { errorMessage } from "@/components/editor";
import { saveCatalogRows } from "./service";

export function CatalogImport({ close }: { close: () => void }) {
  const { notify, data } = useFinance();
  const [input, setInput] = useState<CatalogInput | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({});
  const [filename, setFilename] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const preview = input ? validateCatalog(input, mapping, today()) : null;
  return (
    <Modal
      title="Importar catálogo CSV o JSON"
      description="Solo se guarda al confirmar. No se consultan precios en Internet."
      onClose={() => {
        if (!busy) close();
      }}
    >
      <div className="meal-form">
        <p>
          Selecciona un archivo propio o de una fuente que puedas utilizar.
          Precios en céntimos, cantidades enteras en g/ml/ud y fechas
          AAAA-MM-DD. Los precios importados se marcarán como no verificados.
        </p>
        <label className="field">
          <span>Archivo de catálogo</span>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError("");
              setInput(null);
              try {
                if (file.size > 5 * 1024 * 1024)
                  throw new Error("El archivo supera los 5 MB.");
                const parsed = parseCatalog(
                  await file.text(),
                  file.name.toLowerCase().endsWith(".json") ? "json" : "csv",
                );
                setInput(parsed);
                setFilename(file.name.slice(0, 160));
                setMapping(
                  Object.fromEntries(
                    catalogFields.map((k) => [
                      k,
                      parsed.headers.includes(k) ? k : "",
                    ]),
                  ),
                );
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          />
        </label>
        {input && (
          <>
            <details>
              <summary>Relacionar columnas del archivo</summary>
              <div className="form-grid">
                {catalogFields.map((key) => (
                  <label className="field" key={key}>
                    <span>{catalogLabels[key]}</span>
                    <select
                      aria-label={`Columna: ${catalogLabels[key]}`}
                      value={mapping[key] ?? ""}
                      onChange={(e) =>
                        setMapping({ ...mapping, [key]: e.target.value })
                      }
                    >
                      <option value="">Sin columna</option>
                      {input.headers.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <p>
              {input.records.length} filas · {preview?.errors.length ?? 0}{" "}
              errores. Referencias ya existentes:{" "}
              {preview?.rows.filter((r) =>
                data.products.some((p) => p.externalSku === r.sku),
              ).length ?? 0}
              . Se actualizarán sus datos y se añadirá una observación de
              precio.
            </p>
            {preview && preview.errors.length > 0 && (
              <div className="notice error" role="alert">
                <strong>
                  No se importará ninguna fila hasta corregir todos los errores.
                </strong>
                <ul>
                  {preview.errors.slice(0, 30).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
                {preview.errors.length > 30 && (
                  <p>Hay más errores; revisa el archivo completo.</p>
                )}
              </div>
            )}
            <div className="catalog-preview">
              {preview?.rows.slice(0, 20).map((r, i) => (
                <div key={i}>
                  <strong>{r.name}</strong>
                  <span>
                    {r.sku} · {r.packageQuantity} {r.unit} ·{" "}
                    {money(r.priceCents)}
                  </span>
                  <small>
                    {r.observedAt} · {r.sourceReference} · {r.storeContext}
                  </small>
                </div>
              ))}
            </div>
            {(preview?.rows.length ?? 0) > 20 && (
              <p>Se muestran las primeras 20 filas.</p>
            )}
            <p className="field-hint">
              Un archivo con columnas labelChecked=true declara que has revisado
              las etiquetas de esos productos. Compruébalas antes de marcarlo.
            </p>
          </>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button variant="secondary" disabled={busy} onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !preview ||
              !preview.rows.length ||
              !!preview.errors.length
            }
            onClick={async () => {
              if (!preview) return;
              setBusy(true);
              setError("");
              try {
                await saveCatalogRows(preview.rows, "import", filename);
                notify(`Catálogo importado: ${preview.rows.length} productos.`);
                close();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirmar importación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export function downloadCatalogTemplate() {
  const csv = `${catalogFields.join(";")}\r\n;;;;food;;${today()};;;false;;false\r\n`;
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-catalogo-mercadona.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
