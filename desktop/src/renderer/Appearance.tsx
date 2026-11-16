import { useEffect, useState } from "react";
type Theme = "SYSTEM" | "LIGHT" | "DARK";
const storageKey = "netsentry.desktop.theme";
export function Appearance() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const value = localStorage.getItem(storageKey);
      return value === "LIGHT" || value === "DARK" ? value : "SYSTEM";
    } catch {
      return "SYSTEM";
    }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "DARK" || (theme === "SYSTEM" && media.matches)
          ? "dark"
          : "light";
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      /* Appearance still works for this window. */
    }
    return () => {
      media.removeEventListener("change", apply);
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setTheme(
          event.newValue === "DARK" || event.newValue === "LIGHT"
            ? event.newValue
            : "SYSTEM",
        );
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <label>
      Appearance on this computer
      <select
        value={theme}
        onChange={(event) => setTheme(event.target.value as Theme)}
      >
        <option value="SYSTEM">Use system theme</option>
        <option value="LIGHT">Light</option>
        <option value="DARK">Dark</option>
      </select>
    </label>
  );
}
