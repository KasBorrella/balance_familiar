import { Component, useEffect, useState, type ReactNode } from "react";
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  ArrowLeftRight,
  PiggyBank,
  Ellipsis,
  House,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  WifiOff,
  X,
  Sun,
  Moon,
  Utensils,
  ShoppingBasket,
} from "lucide-react";
import { ThemeProvider, useTheme } from "./theme";
import { repository } from "@/db/repository";
import { FinanceContext, type EditorRequest } from "./context";
import { today, shiftMonth, monthLabel } from "@/domain/calendar";
import type { TableName } from "@/domain/models";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { Planning } from "@/features/budgets/Planning";
import { Transactions } from "@/features/transactions/Transactions";
import { Savings } from "@/features/savings/Savings";
import { Settings } from "@/features/backup/Settings";
import { Meals } from "@/features/meal-planning/Meals";
import { Shopping } from "@/features/shopping/Shopping";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Editor, errorMessage } from "@/components/editor";
const navigation = [
  { path: "/", label: "Resumen", icon: LayoutDashboard },
  { path: "/planificar", label: "Planificar", icon: ChartNoAxesCombined },
  { path: "/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { path: "/ahorro", label: "Ahorro", icon: PiggyBank },
  { path: "/menus", label: "Menús", icon: Utensils },
  { path: "/compra", label: "Compra", icon: ShoppingBasket },
  { path: "/mas", label: "Más", icon: Ellipsis },
];
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="startup">
        <House size={40} />
        <h1>No hemos podido abrir tus datos</h1>
        <p>
          Comprueba que el navegador permite almacenar datos y que queda espacio
          en el dispositivo. No hemos borrado la base de datos.
        </p>
        <p className="field-error">{this.state.error}</p>
        <Button onClick={() => location.reload()}>Volver a intentar</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Shell() {
  const { theme, setPreference } = useTheme();
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<{
    table: TableName;
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [swError, setSwError] = useState(false);
  const location = useLocation();
  const data = useLiveQuery(() => repository.snapshot(), []);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      setSwError(true);
    },
  });
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector(".main-shell")?.scrollTo(0, 0);
  }, [location.pathname]);
  if (!data)
    return (
      <div className="startup" role="status">
        Abriendo tu balance…
      </div>
    );
  const demo = data.settings.some((s) => s.key === "demo" && s.value === true);
  const backup = data.settings.find((s) => s.key === "lastBackup")?.value;
  const staleBackup =
    typeof backup !== "string" ||
    Date.now() - new Date(backup).valueOf() > 7 * 86400000;
  const notify = (message: string, error = false) =>
    setToast({ message, error });
  return (
    <FinanceContext.Provider
      value={{
        data,
        period,
        open: setEditor,
        notify,
        remove: (table, id, name) => setConfirmation({ table, id, name }),
      }}
    >
      <div className="app-layout">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <House size={23} />
            </span>
            <span>
              balance<span className="brand-sub">FAMILIAR</span>
            </span>
          </Link>
          <p className="sidebar-label">MI PRESUPUESTO</p>
          <nav aria-label="Navegación principal">
            {navigation.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} end={path === "/"}>
                <Icon size={20} />
                <span>{label}</span>
                {path === "/mas" && (
                  <span className="desktop-extra"> y ajustes</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <span className="small-icon">
                <ShieldCheck size={20} />
              </span>
              <strong>Datos en este dispositivo</strong>
              <p>Guarda una copia de seguridad para poder recuperarlos.</p>
            </div>
            <div className="household">
              <span>BF</span>
              <div>
                <strong>Mi familia</strong>
                <small>Presupuesto familiar</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <Link to="/" className="mobile-brand">
              <span className="brand-mark">
                <House size={21} />
              </span>
              <strong>balance</strong>
            </Link>
            <span className="desktop-breadcrumb">
              Mi presupuesto <span>/</span>{" "}
              {navigation.find((n) => n.path === location.pathname)?.label ||
                "Resumen"}
            </span>
            <div className="topbar-right">
              <Button
                variant="ghost"
                size="icon"
                className="theme-toggle"
                aria-label={
                  theme === "dark"
                    ? "Activar modo claro"
                    : "Activar modo oscuro"
                }
                title={
                  theme === "dark"
                    ? "Activar modo claro"
                    : "Activar modo oscuro"
                }
                onClick={() => {
                  if (!setPreference(theme === "dark" ? "light" : "dark"))
                    notify(
                      "El tema se ha cambiado, pero el navegador no permite guardar la preferencia.",
                      true,
                    );
                }}
              >
                {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
              </Button>
              <span className="connection">
                <span className={`status-dot ${online ? "" : "offline"}`} />
                {online ? (
                  "Guardado local"
                ) : (
                  <>
                    <WifiOff size={14} />
                    Sin conexión
                  </>
                )}
              </span>
              <Button
                onClick={() => setEditor({ kind: "transaction" })}
                className="desktop-new"
              >
                <Plus size={17} />
                Nuevo movimiento
              </Button>
            </div>
          </header>
          <div className="content">
            <div className="period-toolbar">
              <span className="period-caption">TU BALANCE FAMILIAR</span>
              <div className="period-control">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mes anterior"
                  onClick={() => setPeriod(shiftMonth(period, -1))}
                >
                  <ChevronLeft size={18} />
                </Button>
                <label className="month-picker">
                  <span>{monthLabel(period)}</span>
                  <input
                    type="month"
                    aria-label="Mes seleccionado"
                    value={period}
                    min="1900-01"
                    max="2200-12"
                    onChange={(e) => {
                      if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
                        setPeriod(e.target.value);
                    }}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mes siguiente"
                  onClick={() => setPeriod(shiftMonth(period, 1))}
                >
                  <ChevronRight size={18} />
                </Button>
                {period !== today().slice(0, 7) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPeriod(today().slice(0, 7))}
                  >
                    Hoy
                  </Button>
                )}
              </div>
            </div>
            {demo && (
              <div className="demo-banner">
                <span>
                  <strong>Modo demostración</strong>
                  <span> · Estás viendo datos ficticios.</span>
                </span>
                <Link to="/mas">
                  Empezar con mis datos <ChevronRight size={16} />
                </Link>
              </div>
            )}
            {staleBackup && !demo && (
              <div className="notice backup-notice">
                {backup
                  ? "Hace más de 7 días que no generas una copia."
                  : "Todavía no tienes una copia de seguridad."}{" "}
                <Link to="/mas">Guardar una copia</Link>
              </div>
            )}
            {swError && (
              <div className="notice error">
                No se ha podido preparar la aplicación para usarla sin conexión.
                Vuelve a cargar con conexión antes de usar la app en modo avión.
              </div>
            )}
            {offlineReady && (
              <span className="sr-only" role="status">
                Aplicación preparada para funcionar sin conexión.
              </span>
            )}
            <main id="main-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/planificar" element={<Planning />} />
                <Route path="/movimientos" element={<Transactions />} />
                <Route path="/ahorro" element={<Savings />} />
                <Route path="/mas" element={<Settings />} />
                <Route path="/menus" element={<Meals />} />
                <Route path="/compra" element={<Shopping />} />
                <Route
                  path="*"
                  element={
                    <div className="empty">
                      <h1>No encontramos esa página</h1>
                      <Link to="/">Volver al resumen</Link>
                    </div>
                  }
                />
              </Routes>
            </main>
            <footer className="page-footer">
              <span>Balance Familiar</span>
              <span>EUR · Datos locales</span>
            </footer>
          </div>
        </div>
        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navigation
            .filter((n) => n.path !== "/compra")
            .map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} end={path === "/"}>
                <Icon size={21} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        <Button
          className="mobile-fab"
          aria-label="Nuevo movimiento"
          onClick={() => setEditor({ kind: "transaction" })}
        >
          <Plus size={23} />
        </Button>
      </div>
      {editor && <Editor request={editor} close={() => setEditor(null)} />}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar aviso"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </Button>
        </div>
      )}
      {needRefresh && (
        <div className="update-banner">
          <strong>Hay una nueva versión disponible.</strong>
          <span>
            {editor
              ? "Termina de editar antes de actualizar."
              : "Tus datos se conservarán al actualizar."}
          </span>
          <Button
            disabled={!!editor || deleting}
            onClick={() => {
              if (document.querySelector('[role="dialog"]')) {
                notify("Termina de editar antes de actualizar.");
                return;
              }
              void updateServiceWorker(true);
            }}
          >
            Actualizar
          </Button>
          <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
            Más tarde
          </Button>
        </div>
      )}
      {confirmation && (
        <Modal
          title={`¿Eliminar ${confirmation.name}?`}
          description={
            [
              "mealPlans",
              "mealEntries",
              "recipes",
              "ingredients",
              "householdMembers",
            ].includes(confirmation.table)
              ? "No se puede deshacer. Borrar un menú también elimina sus comidas. Las recetas y los ingredientes que estén en uso no se pueden eliminar."
              : "No se puede deshacer. Los cobros y pagos ya anotados se conservarán si eliminas una previsión."
          }
          onClose={() => {
            if (!deleting) setConfirmation(null);
          }}
        >
          <div className="restore-preview">
            <p>
              Si hay categorías, fondos u objetivos vinculados, primero tendrás
              que mover o eliminar sus referencias.
            </p>
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={deleting}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await repository.remove(
                      confirmation.table,
                      confirmation.id,
                    );
                    setConfirmation(null);
                    notify("Se ha eliminado.");
                  } catch (e) {
                    notify(errorMessage(e), true);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </FinanceContext.Provider>
  );
}
export function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <HashRouter>
          <a className="skip-link" href="#main-content">
            Saltar al contenido
          </a>
          <Shell />
        </HashRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
