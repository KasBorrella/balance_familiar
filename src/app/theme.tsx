import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";
type Theme = "light" | "dark";
const storageKey = "balance-familiar-theme";
const isPreference = (value: unknown): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";
function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(storageKey);
    return isPreference(value) ? value : "system";
  } catch {
    return "system";
  }
}
const ThemeContext = createContext<{
  preference: ThemePreference;
  theme: Theme;
  setPreference: (value: ThemePreference) => boolean;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const theme: Theme =
    preference === "system" ? (systemDark ? "dark" : "light") : preference;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#101916" : "#f2f5f1");
  }, [theme]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setPreferenceState(readPreference());
    };
    query.addEventListener("change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      query.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  function setPreference(value: ThemePreference) {
    setPreferenceState(value);
    try {
      localStorage.setItem(storageKey, value);
      return true;
    } catch {
      return false;
    }
  }
  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value)
    throw new Error("No se ha cargado la configuración de apariencia.");
  return value;
}
