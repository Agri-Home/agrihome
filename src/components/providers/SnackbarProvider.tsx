"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode
} from "react";

type SnackbarTone = "success" | "error" | "info";

interface SnackbarItem {
  id: number;
  message: string;
  tone: SnackbarTone;
  dismissing: boolean;
}

interface SnackbarContext {
  show: (message: string, tone?: SnackbarTone) => void;
}

const Ctx = createContext<SnackbarContext>({ show: () => {} });

export const useSnackbar = () => useContext(Ctx);

const DURATION = 3500;

const toneStyles: Record<SnackbarTone, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  info: "bg-ink text-white"
};

const toneIcons: Record<SnackbarTone, ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, dismissing: true } : item
      )
    );
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 300);
  }, []);

  const show = useCallback(
    (message: string, tone: SnackbarTone = "success") => {
      const id = nextId.current++;
      setItems((prev) => [...prev, { id, message, tone, dismissing: false }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss]
  );

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`flex max-w-sm items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-lift ${
              toneStyles[item.tone]
            } ${item.dismissing ? "animate-slide-down" : "animate-slide-up"}`}
          >
            {toneIcons[item.tone]}
            <span>{item.message}</span>
            <button
              onClick={() => dismiss(item.id)}
              className="ml-2 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
