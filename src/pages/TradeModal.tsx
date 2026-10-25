import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { api, money } from "../api";
import { ErrorBox } from "../components";
import type { Stock } from "../types";
import { UNIVERSE } from "../types";
export function TradeModal({
  initial,
  stocks,
  onClose,
  onSuccess,
}: {
  initial: { symbol: string; side: "buy" | "sell" };
  stocks: Stock[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [symbol, setSymbol] = useState(initial.symbol),
    [side, setSide] = useState(initial.side),
    [quantity, setQuantity] = useState("1"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const stock = stocks.find((s) => s.symbol === symbol);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Tab") {
        const controls = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select",
          ) ?? [],
        );
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, busy]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/trades", { symbol, side, quantity: Number(quantity) });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-title"
      >
        <button
          className="modal-close"
          aria-label="Schließen"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">AUSSCHLIESSLICH VIRTUELLES KAPITAL</span>
        <h2 id="trade-title">Deine nächste Entscheidung.</h2>
        <p>Ein simulierter Auftrag in deinem persönlichen Portfolio.</p>
        <form onSubmit={submit}>
          <label>
            Unternehmen
            <select
              autoFocus
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {Object.entries(UNIVERSE).map(([s, n]) => (
                <option key={s} value={s}>
                  {n} · {s}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Auftrag
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as "buy" | "sell")}
              >
                <option value="buy">Kaufen</option>
                <option value="sell">Verkaufen</option>
              </select>
            </label>
            <label>
              Stückzahl
              <input
                type="number"
                min="0.000001"
                max="1000000"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
          </div>
          <div className="trade-summary">
            <span>
              Referenzkurs
              <strong>
                {stock
                  ? money(stock.price, stock.currency)
                  : "Wird beim Auftrag geladen"}
              </strong>
            </span>
            <span>
              Gebühr<strong>0,1 % · mindestens 1 €</strong>
            </span>
            <span>
              Währung<strong>USD → EUR zum historischen Tageskurs</strong>
            </span>
          </div>
          <p className="fineprint">
            Ausführung zum letzten gemeinsamen vollständigen Tageskurs, keine
            echte Börsenorder. Keine Slippage oder Steuern. Gebühren werden
            zusätzlich abgezogen.
          </p>
          {error && <ErrorBox message={error} />}
          <button
            className="button primary full-width"
            disabled={busy || !Number(quantity)}
          >
            {busy ? (
              <>
                <RefreshCw className="spin" size={15} />
                Kursdaten prüfen …
              </>
            ) : (
              <>
                <Check size={16} />
                Virtuellen {side === "buy" ? "Kauf" : "Verkauf"} bestätigen
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
