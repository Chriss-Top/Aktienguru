import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { api } from "./api";
import { ErrorBox } from "./components";
import type { Dashboard } from "./types";
import { DashboardPage } from "./pages/DashboardPage";
import { DetailPage } from "./pages/DetailPage";
import { TradeModal } from "./pages/TradeModal";
import { PortfolioPage } from "./pages/PortfolioPage";
import { BacktestPage } from "./pages/BacktestPage";
import { PredictionPage } from "./pages/PredictionPage";
import { MethodPage } from "./pages/MethodPage";
const nav = [
  ["dashboard", "Übersicht", LayoutDashboard],
  ["portfolio", "Mein Portfolio", Wallet],
  ["guru", "Guru-Portfolio", Sparkles],
  ["backtest", "Backtesting", FlaskConical],
  ["predictions", "Prognosejournal", BookOpen],
] as const;
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  useEffect(() => {
    const on = () => setRoute(location.hash.slice(1) || "dashboard");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
export function App() {
  const route = useRoute(),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [trade, setTrade] = useState<{
      symbol: string;
      side: "buy" | "sell";
    } | null>(null),
    [portfolioRevision, setPortfolioRevision] = useState(0),
    [apiHealthy, setApiHealthy] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api<Dashboard>("/dashboard")
      .then((d) => {
        if (live) setDashboard(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    api<{ status: string }>("/health")
      .then((d) => setApiHealthy(d.status === "ok"))
      .catch(() => setApiHealthy(false));
  }, []);
  const page = route.startsWith("stock/")
    ? "Analyse"
    : nav.find((n) => n[0] === route)?.[1] || "Methodik";
  const refreshData = () => {
    setRefresh((r) => r + 1);
    setPortfolioRevision((r) => r + 1);
  };
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="#dashboard" aria-label="Guru Startseite">
          <span className="brand-mark">
            <Sparkles size={24} />
          </span>
          guru<span className="brand-point">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">P</span>
          <div>
            Persönlicher Workspace<small>Virtuelles Investieren</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <a
              href={"#" + id}
              key={id}
              className={route === id ? "selected" : ""}
              onClick={() => setMenu(false)}
            >
              <Icon size={18} />
              {label}
              {id === "guru" && <span className="nav-new">NEU</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <div>
            <ShieldCheck size={18} />
            <strong>Verstehen. Dann investieren.</strong>
          </div>
          <p>
            Nachvollziehbare Modelle.
            <br />
            Deine Entscheidungen.
          </p>
          <a href="#method">
            Unsere Methodik <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="sidebar-bottom">
          <a href="#method">
            <BookOpen size={17} /> Methodik & Daten
          </a>
          <span>
            <i className={apiHealthy ? "status-dot" : "status-dot offline"} />
            {apiHealthy
              ? __GURU_STATIC__
                ? "Im Browser · privat gespeichert"
                : "Lokale API verbunden"
              : "Datenzugriff nicht verfügbar"}
          </span>
          <div className="profile">
            <span>DU</span>
            <div>
              Dein Workspace<small>Nur Simulation · kein Echtgeld</small>
            </div>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Menü schließen"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu"
              aria-label="Menü öffnen"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="paper-mode">
              <i />
              Paper Trading
            </span>
            <span className="avatar">DU</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">DEIN MARKT. DEINE PERSPEKTIVE.</div>
              <h1>
                {route === "dashboard" ? (
                  <>
                    Klarheit für dein <span>nächstes Investment.</span>
                  </>
                ) : route === "portfolio" ? (
                  "Dein Portfolio. Deine Strategie."
                ) : route === "guru" ? (
                  "Die Strategie im Praxistest."
                ) : route === "backtest" ? (
                  "Ideen testen. Annahmen hinterfragen."
                ) : route === "predictions" ? (
                  "Jede Prognose bleibt überprüfbar."
                ) : route.startsWith("stock/") ? (
                  "Unternehmen verstehen."
                ) : (
                  "Transparenz ist unser Fundament."
                )}
              </h1>
              <p>
                {route === "dashboard"
                  ? "Entdecke quantitative Signale, verstehe Trends und entwickle deine Strategie."
                  : "Transparente Analyse. Echte Daten. Ausschließlich virtuelles Kapital."}
              </p>
            </div>
            <button
              className="button secondary refresh"
              disabled={loading}
              onClick={refreshData}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Aktualisieren
            </button>
          </div>
          {__GURU_STATIC__ && (
            <div className="info-strip">
              <ShieldCheck size={18} />
              <p>
                <strong>Öffentliche Browser-Version.</strong> Echte Tageskurse,
                kein Livefeed.{" "}
                {dashboard?.stocks[0] && (
                  <>
                    Kurstag {dashboard.stocks[0].date}, Abruf{" "}
                    {new Date(dashboard.stocks[0].fetched_at).toLocaleString(
                      "de-DE",
                    )}
                    .{" "}
                  </>
                )}
                Portfolios und Hypothesen bleiben ausschließlich in diesem
                Browser. Kein Login, kein Geräteabgleich. Beim Löschen der
                Website-Daten gehen sie verloren.
              </p>
            </div>
          )}
          {error && <ErrorBox message={error} retry={refreshData} />}
          {route === "dashboard" ? (
            <DashboardPage
              data={dashboard}
              loading={loading}
              query={query}
              setQuery={setQuery}
              onTrade={(s) => setTrade({ symbol: s, side: "buy" })}
            />
          ) : route.startsWith("stock/") ? (
            <DetailPage
              key={route + refresh}
              symbol={route.split("/")[1]}
              onTrade={(s) => setTrade({ symbol: s, side: "buy" })}
            />
          ) : route === "portfolio" || route === "guru" ? (
            <PortfolioPage
              kind={route === "guru" ? "guru" : "personal"}
              revision={portfolioRevision}
              onTrade={(symbol, side) => setTrade({ symbol, side })}
            />
          ) : route === "backtest" ? (
            <BacktestPage />
          ) : route === "predictions" ? (
            <PredictionPage />
          ) : (
            <MethodPage />
          )}
          <footer>
            <span>
              <ShieldCheck size={13} />
              Research, keine Anlageberatung.
            </span>
            <span>
              Guru v1.0 <i /> Kein Echtgeldhandel <i /> Keine behauptete
              Prognosegenauigkeit
            </span>
          </footer>
        </main>
      </div>
      {trade && (
        <TradeModal
          initial={trade}
          stocks={dashboard?.stocks ?? []}
          onClose={() => setTrade(null)}
          onSuccess={() => {
            setTrade(null);
            setPortfolioRevision((r) => r + 1);
          }}
        />
      )}
    </div>
  );
}
