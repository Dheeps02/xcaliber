import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface Tip {
  text: string;
  x: number;
  y: number;
  visible: boolean;
}

interface TooltipCtx {
  showTip: (el: HTMLElement, text: string) => void;
  hideTip: () => void;
}

const Ctx = createContext<TooltipCtx>({ showTip: () => {}, hideTip: () => {} });

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip>({ text: '', x: 0, y: 0, visible: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tipRef = useRef<HTMLDivElement>(null);

  const showTip = useCallback((el: HTMLElement, text: string) => {
    clearTimeout(timer.current);
    const rect = el.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 5;
    setTip({ text, x, y, visible: true });
    requestAnimationFrame(() => {
      if (!tipRef.current) return;
      const tr = tipRef.current.getBoundingClientRect();
      if (tr.right > window.innerWidth - 8) x = Math.max(8, window.innerWidth - tr.width - 8);
      if (tr.bottom > window.innerHeight - 8) y = rect.top - tr.height - 5;
      setTip((prev) => ({ ...prev, x, y }));
    });
  }, []);

  const hideTip = useCallback(() => {
    timer.current = setTimeout(
      () => setTip((p) => ({ ...p, visible: false })),
      140
    );
  }, []);

  return (
    <Ctx.Provider value={{ showTip, hideTip }}>
      {children}
      {createPortal(
        <div
          ref={tipRef}
          style={{
            position: 'fixed',
            top: tip.y,
            left: tip.x,
            opacity: tip.visible ? 1 : 0,
            display: tip.text ? 'block' : 'none',
            transition: 'opacity 130ms ease',
            pointerEvents: 'none',
            zIndex: 9999,
            maxWidth: 220,
          }}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1.5 text-[10px] leading-relaxed"
        >
          {tip.text}
        </div>,
        document.body
      )}
    </Ctx.Provider>
  );
}

export const useTooltip = () => useContext(Ctx);
