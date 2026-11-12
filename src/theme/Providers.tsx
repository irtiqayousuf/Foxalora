"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useServerInsertedHTML } from "next/navigation";
import {
  FluentProvider,
  RendererProvider,
  SSRProvider,
  createDOMRenderer,
  renderToStyleElements,
} from "@fluentui/react-components";
import { darkTheme, lightTheme, type ThemeMode } from "./theme";

const STORAGE_KEY = "foxalora-theme";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside <Providers>");
  return ctx;
}

export function Providers({ children }: { children: ReactNode }) {
  // Griffel (Fluent's CSS-in-JS) renderer, with styles injected during SSR.
  const [renderer] = useState(() => createDOMRenderer());
  const [mode, setModeState] = useState<ThemeMode>("light");

  useServerInsertedHTML(() => <>{renderToStyleElements(renderer)}</>);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") return setModeState(saved);
    } catch {}
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setModeState("dark");
    }
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  };

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <ThemeContext.Provider
          value={{
            mode,
            setMode,
            toggle: () => setMode(mode === "light" ? "dark" : "light"),
          }}
        >
          <FluentProvider
            theme={mode === "dark" ? darkTheme : lightTheme}
            style={{ minHeight: "100vh" }}
          >
            {children}
          </FluentProvider>
        </ThemeContext.Provider>
      </SSRProvider>
    </RendererProvider>
  );
}
