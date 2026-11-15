import { useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  Folder,
  HardDrive,
  ArrowUpRight,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "@/app/theme";
import { useFinance } from "@/app/context";
import {
  exportBackup,
  restoreBackup,
  validateBackup,
  type Backup,
} from "./service";
import { repository } from "@/db/repository";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import {
  Card,
  PageHeading,
  SectionTitle,
  RowActions,
  AddButton,
} from "@/components/common";
import { errorMessage } from "@/components/editor";
import { tableNames } from "@/domain/models";
export function Settings() {
  const { preference, setPreference } = useTheme();
  const { data, notify, open, remove } = useFinance();
  const [preview, setPreview] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(false);
  const demo = data.settings.some((s) => s.key === "demo" && s.value === true);
  const last = data.settings.find((s) => s.key === "lastBackup")?.value;
  async function download() {
    setBusy(true);
    setError("");
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const name = `balance-familiar-backup-${backup.exportedAt.slice(0, 10)}.json`;
      const file = new File([blob], name, { type: "application/json" });
      let shared = false;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Copia de Balance Familiar",
          });
          shared = true;
        } catch (shareError) {
          if (
            shareError instanceof DOMException &&
            shareError.name === "AbortError"
          )
            return;
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      await repository.setSetting("lastBackup", backup.exportedAt);
      notify(
        "Copia generada. Comprueba que el archivo está guardado en Archivos o Descargas.",
      );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function inspect(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("El archivo supera el límite de 20 MB.");
      setPreview(await validateBackup(JSON.parse(await file.text())));
    } catch (e) {
      setError(`No se puede restaurar: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN"
        title="Ajustes"
        description="Apariencia, categorías y copias de seguridad."
      />
      <Card className="appearance-card">
        <div>
          <p className="eyebrow">PERSONALIZACIÓN</p>
          <h2>Apariencia</h2>
          <p className="muted">
            Elige el tema de la aplicación. Se guardará en este navegador.
          </p>
        </div>
        <div
          className="theme-options"
          role="group"
          aria-label="Tema de la aplicación"
        >
          {(
            [
              { value: "light", label: "Claro", Icon: Sun },
              { value: "dark", label: "Oscuro", Icon: Moon },
              { value: "system", label: "Según el dispositivo", Icon: Monitor },
            ] as const
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={preference === value}
              onClick={() => {
                if (!setPreference(value))
                  notify(
                    "El tema se ha cambiado, pero el navegador no permite guardar la preferencia.",
                    true,
                  );
              }}
            >
              <span
                className={`theme-swatch theme-swatch-${value}`}
                aria-hidden
              >
                <i />
                <i />
                <i />
              </span>
              <span>
                <Icon size={16} />
                {label}
              </span>
            </button>
          ))}
        </div>
      </Card>
      <div className="two-columns">
        <Card>
          <div className="small-icon">
            <ShieldCheck />
          </div>
          <h2 className="spaced-title">Copias de seguridad</h2>
          <p className="muted">
            Los datos se guardan en este dispositivo. iOS o el navegador pueden
            eliminarlos. Guarda una copia periódica en Archivos o iCloud Drive.
          </p>
          <div className="backup-status">
            <span>Última copia generada</span>
            <strong>
              {typeof last === "string"
                ? new Intl.DateTimeFormat("es-ES", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/Madrid",
                  }).format(new Date(last))
                : "Todavía no has creado una copia"}
            </strong>
            <small>
              Esta fecha indica la generación del archivo; comprueba que lo has
              conservado.
            </small>
          </div>
          <div className="inline-actions">
            <Button onClick={download} disabled={busy}>
              <Download size={18} />
              Exportar copia
            </Button>
            <label
              className={`btn btn-secondary file-button ${busy ? "disabled" : ""}`}
            >
              <Upload size={18} />
              Restaurar copia
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Restaurar copia JSON"
                disabled={busy}
                onChange={(e) => {
                  void inspect(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="field-hint">
            JSON versionado con comprobación de integridad. La copia contiene
            tus datos: guárdala en un lugar privado.
          </p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
        </Card>
        <Card>
          <div className="small-icon sand-bg">
            <Smartphone />
          </div>
          <h2 className="spaced-title">Instalar en el iPhone</h2>
          <ol className="install-steps">
            <li>Abre la dirección publicada con HTTPS en Safari.</li>
            <li>
              Pulsa <strong>Compartir</strong> y busca{" "}
              <strong>Añadir a pantalla de inicio</strong>.
            </li>
            <li>
              Abre Balance Familiar desde su icono y espera a que termine la
              primera carga.
            </li>
          </ol>
          <p className="muted">
            Después podrás registrar y consultar tus datos sin conexión. Cada
            navegador o dispositivo guarda una copia independiente; no hay
            sincronización.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const persistent = await navigator.storage?.persist?.();
                notify(
                  persistent
                    ? "El navegador ha concedido almacenamiento persistente. Sigue haciendo copias."
                    : "El navegador no garantiza conservar los datos. Mantén tus copias de seguridad.",
                );
              } catch (e) {
                notify(errorMessage(e), true);
              }
            }}
          >
            <HardDrive size={18} />
            Solicitar conservación de datos
          </Button>
        </Card>
      </div>
      <Card>
        <SectionTitle title="Tus categorías">
          <AddButton onClick={() => open({ kind: "category" })}>
            Categoría
          </AddButton>
        </SectionTitle>
        <p className="card-subtitle">
          Hasta tres niveles. El orden se cambia desde la edición. Para eliminar
          una categoría, primero mueve o elimina sus referencias.
        </p>
        {[...data.categories]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => (
            <div className="expense-row" key={c.id}>
              <Folder size={19} className="muted" />
              <div>
                <strong>{c.name}</strong>
                <small>
                  {data.categories.find((p) => p.id === c.parentId)?.name ||
                    "Categoría principal"}{" "}
                  · orden {c.sortOrder}
                </small>
              </div>
              <RowActions
                name={c.name}
                edit={() => open({ kind: "category", row: c })}
                remove={() => remove("categories", c.id, c.name)}
              />
            </div>
          ))}
      </Card>
      <Card>
        <SectionTitle
          title={
            demo
              ? "Eliminar los datos de ejemplo"
              : "Gestionar los datos de este dispositivo"
          }
        />
        <p className="muted">
          {demo
            ? "Estás explorando datos ficticios. Empezar desde cero elimina la demostración y todos los cambios hechos dentro de ella."
            : "Vaciar la aplicación elimina todos los registros de este dispositivo. Exporta primero una copia si quieres conservarlos."}
        </p>
        <Button variant="secondary" onClick={() => setReset(true)}>
          {demo ? "Empezar con mis datos" : "Vaciar los datos"}
          <ArrowUpRight size={16} />
        </Button>
      </Card>
      {preview && (
        <Modal
          title="Revisar copia antes de restaurar"
          description="La copia sustituirá todos los datos actuales. No se mezclarán con los del archivo."
          onClose={() => {
            if (!busy) setPreview(null);
          }}
        >
          <div className="restore-preview">
            <p>
              Copia del{" "}
              {new Date(preview.exportedAt).toLocaleString("es-ES", {
                timeZone: "Europe/Madrid",
              })}{" "}
              · versión {preview.appVersion}
            </p>
            <div className="notice">
              Integridad y relaciones verificadas.{" "}
              {preview.data.settings.some((s) => s.key === "demo" && s.value)
                ? "Contiene datos de demostración."
                : "Contiene datos personales."}
            </div>
            <dl className="detail-list">
              <div>
                <dt>Categorías</dt>
                <dd>{preview.data.categories.length}</dd>
              </div>
              <div>
                <dt>Gastos previstos</dt>
                <dd>{preview.data.expenseRules.length}</dd>
              </div>
              <div>
                <dt>Movimientos</dt>
                <dd>{preview.data.transactions.length}</dd>
              </div>
              <div>
                <dt>Total de registros</dt>
                <dd>
                  {tableNames.reduce(
                    (n, key) => n + preview.data[key].length,
                    0,
                  )}
                </dd>
              </div>
            </dl>
            <p>
              Para conservar tu situación actual, cancela y exporta una copia
              antes de continuar.
            </p>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await restoreBackup(preview);
                    setPreview(null);
                    notify("Copia restaurada correctamente.");
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Restaurando…" : "Sustituir y restaurar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal
          title="¿Empezar desde cero?"
          description="Se borrarán todos los datos de la aplicación, incluidos los cambios que hayas hecho en los ejemplos."
          onClose={() => {
            if (!busy) setReset(false);
          }}
        >
          <div className="restore-preview">
            <p>Esta acción no se puede deshacer sin una copia de seguridad.</p>
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setReset(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await repository.startFresh();
                    setReset(false);
                    notify(
                      "Se han eliminado los datos. Ya puedes añadir los tuyos.",
                    );
                  } catch (e) {
                    notify(errorMessage(e), true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Eliminar datos y empezar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
