import { useEffect, useState } from "react";
export type Theme = "SYSTEM" | "LIGHT" | "DARK";
const storageKey = "netsentry.desktop.theme";
export function useAppearance() {
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
  return { theme, setTheme };
}
export function Appearance({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (value: Theme) => void;
}) {
  return (
    <section className="desktop-card" aria-labelledby="appearance-heading">
      <h2 id="appearance-heading">Desktop appearance</h2>
      <p>
        Choose Light, Dark or System. Your choice is stored locally on this
        computer.
      </p>
      <fieldset className="desktop-appearance-choices">
        <legend>Appearance on this computer</legend>
        {(["LIGHT", "DARK", "SYSTEM"] as const).map((value) => (
          <label className={theme === value ? "chosen" : ""} key={value}>
            <input
              type="radio"
              name="appearance"
              checked={theme === value}
              onChange={() => setTheme(value)}
            />
            <span>
              {value === "SYSTEM"
                ? "Use system theme"
                : value === "LIGHT"
                  ? "Light"
                  : "Dark"}
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
