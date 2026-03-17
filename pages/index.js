import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://cryptoia-api.onrender.com";

function badgeStyle(type) {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: 12,
    fontWeight: "bold",
  };

  if (type === "long") return { ...base, background: "#123d26", color: "#5df28c" };
  if (type === "short") return { ...base, background: "#4a1626", color: "#ff9b9b" };
  if (type === "open") return { ...base, background: "#12304a", color: "#8ecbff" };
  if (type === "closed") return { ...base, background: "#3f3f3f", color: "#ffffff" };
  if (type === "win") return { ...base, background: "#123d26", color: "#5df28c" };
  if (type === "loss") return { ...base, background: "#4a1626", color: "#ff9b9b" };

  return { ...base, background: "#2c2c2c", color: "#fff" };
}

function pnlColor(value) {
  if (value > 0) return "#5df28c";
  if (value < 0) return "#ff9b9b";
  return "#ffffff";
}

function formatTs(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("fr-CA");
}

function cardStyle() {
  return {
    background: "#0d1f44",
    padding: 20,
    borderRadius: 16,
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  };
}

function tableStyle() {
  return {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  };
}

function thtd() {
  return {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    verticalAlign: "top",
  };
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  async function refreshAll() {
    setLoading(true);

    try {
      const [
        configRes,
        stateRes,
        signalsRes,
        tradesRes,
        openTradesRes,
        closedTradesRes,
        statsRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/v1/config`),
        fetch(`${API_BASE}/api/v1/state`),
        fetch(`${API_BASE}/api/v1/signals`),
        fetch(`${API_BASE}/api/v1/trades`),
        fetch(`${API_BASE}/api/v1/open-trades`),
        fetch(`${API_BASE}/api/v1/closed-trades`),
        fetch(`${API_BASE}/api/v1/stats`),
      ]);

      if (
        !configRes.ok ||
        !stateRes.ok ||
        !signalsRes.ok ||
        !tradesRes.ok ||
        !openTradesRes.ok ||
        !closedTradesRes.ok ||
        !statsRes.ok
      ) {
        throw new Error("Une ou plusieurs requêtes API ont échoué.");
      }

      const configData = await configRes.json();
      const stateData = await stateRes.json();
      const signalsData = await signalsRes.json();
      const tradesData = await tradesRes.json();
      const openTradesData = await openTradesRes.json();
      const closedTradesData = await closedTradesRes.json();
      const statsData = await statsRes.json();

      setConfig(configData);
      setState(stateData);
      setSignals(signalsData.items || []);
      setTrades(tradesData.items || []);
      setOpenTrades(openTradesData.items || []);
      setClosedTrades(closedTradesData.items || []);
      setStats(statsData || null);
      setLastUpdated(new Date());

      if (stateData?.last_error) {
        setError(stateData.last_error);
      } else {
        setError("");
      }
    } catch (err) {
      console.error("Erreur refreshAll:", err);
      setError("Impossible de récupérer les données du bot.");
    } finally {
      setLoading(false);
    }
  }

  async function callPost(url, fallbackMessage) {
    const res = await fetch(url, { method: "POST" });
    const data = await res.json();

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.message || fallbackMessage);
    }

    return data;
  }

  async function startBot() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/bot/start`, "Impossible de démarrer le bot.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de démarrer le bot.");
    }
  }

  async function stopBot() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/bot/stop`, "Impossible d'arrêter le bot.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'arrêter le bot.");
    }
  }

  async function tickBot() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/bot/tick`, "Impossible de lancer un tick.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de lancer un tick.");
    }
  }

  async function forceMarketRefresh() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/market/refresh`, "Impossible de forcer le refresh marché.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de forcer le refresh marché.");
    }
  }

  async function resetPaperAccount() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/bot/reset`, "Impossible de reset le paper account.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de reset le paper account.");
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const botStatus = useMemo(() => {
    if (!state) return "inconnu";
    return state.running ? "en marche" : "arrêté";
  }, [state]);

  const lastUpdatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString("fr-CA")
    : "jamais";

  return (
    <main
      style={{
        background: "#06142b",
        minHeight: "100vh",
        color: "white",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>MEXC AI Trading Bot v6 Pro</h1>
      <p style={{ marginTop: 0 }}>
        Dashboard paper trading plus clair, plus visuel et plus pratique.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={startBot}>Démarrer</button>
        <button onClick={stopBot}>Arrêter</button>
        <button onClick={tickBot}>Lancer un tick</button>
        <button onClick={refreshAll}>Rafraîchir</button>
        <button onClick={forceMarketRefresh}>Forcer refresh marché</button>
        <button onClick={resetPaperAccount}>Reset paper account</button>
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 12,
          background: "#0d1f44",
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <strong>Statut du bot:</strong>{" "}
          <span style={{ color: state?.running ? "#5df28c" : "#ff9b9b", fontWeight: "bold" }}>
            {botStatus}
          </span>
        </div>

        <div><strong>Dernière mise à jour:</strong> {lastUpdatedText}</div>
        <div><strong>Chargement:</strong> {loading ? "oui" : "non"}</div>
        <div><strong>Ticks:</strong> {state?.tick_count ?? 0}</div>
        <div><strong>Positions ouvertes:</strong> {state?.open_positions ?? 0}</div>
      </div>

      {stats && (
        <div
          style={{
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {[
            ["Capital départ", stats.starting_equity_usd, "#ffffff"],
            ["Capital actuel", stats.equity_usd, "#ffffff"],
            ["PnL réalisé", stats.realized_pnl_usd, pnlColor(stats.realized_pnl_usd)],
            ["PnL non réalisé", stats.unrealized_pnl_usd, pnlColor(stats.unrealized_pnl_usd)],
            ["PnL total", stats.total_pnl_usd, pnlColor(stats.total_pnl_usd)],
            ["Wins", stats.wins, "#5df28c"],
            ["Losses", stats.losses, "#ff9b9b"],
            ["Win rate", `${stats.win_rate_pct}%`, "#ffffff"],
          ].map(([label, value, color]) => (
            <div key={label} style={cardStyle()}>
              <div style={{ opacity: 0.8, marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: "bold", color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 20,
            padding: 12,
            borderRadius: 12,
            background: "#4a1626",
            color: "#ffd2d2",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <section style={cardStyle()}>
          <h2>Configuration</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(config, null, 2)}</pre>
        </section>

        <section style={cardStyle()}>
          <h2>État</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(state, null, 2)}</pre>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <section style={cardStyle()}>
          <h2>Positions ouvertes</h2>
          <table style={tableStyle()}>
            <thead>
              <tr>
                <th style={thtd()}>Symbole</th>
                <th style={thtd()}>Side</th>
                <th style={thtd()}>Entrée</th>
                <th style={thtd()}>Prix actuel</th>
                <th style={thtd()}>PnL flottant</th>
                <th style={thtd()}>Score</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.length === 0 ? (
                <tr><td style={thtd()} colSpan={6}>Aucune position ouverte</td></tr>
              ) : (
                openTrades.map((t) => (
                  <tr key={t.id}>
                    <td style={thtd()}>{t.symbol}</td>
                    <td style={thtd()}><span style={badgeStyle(t.side)}>{t.side.toUpperCase()}</span></td>
                    <td style={thtd()}>{t.entry}</td>
                    <td style={thtd()}>{t.current_price}</td>
                    <td style={{ ...thtd(), color: pnlColor(t.unrealized_pnl_usd) }}>{t.unrealized_pnl_usd}</td>
                    <td style={thtd()}>{t.score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section style={cardStyle()}>
          <h2>Trades fermés</h2>
          <table style={tableStyle()}>
            <thead>
              <tr>
                <th style={thtd()}>Symbole</th>
                <th style={thtd()}>Side</th>
                <th style={thtd()}>Résultat</th>
                <th style={thtd()}>Entrée</th>
                <th style={thtd()}>Sortie</th>
                <th style={thtd()}>PnL</th>
              </tr>
            </thead>
            <tbody>
              {closedTrades.length === 0 ? (
                <tr><td style={thtd()} colSpan={6}>Aucun trade fermé</td></tr>
              ) : (
                closedTrades.map((t) => (
                  <tr key={t.id}>
                    <td style={thtd()}>{t.symbol}</td>
                    <td style={thtd()}><span style={badgeStyle(t.side)}>{t.side.toUpperCase()}</span></td>
                    <td style={thtd()}><span style={badgeStyle(t.result)}>{(t.result || "").toUpperCase()}</span></td>
                    <td style={thtd()}>{t.entry}</td>
                    <td style={thtd()}>{t.exit}</td>
                    <td style={{ ...thtd(), color: pnlColor(t.pnl_usd) }}>{t.pnl_usd}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <section style={cardStyle()}>
          <h2>Signaux</h2>
          <table style={tableStyle()}>
            <thead>
              <tr>
                <th style={thtd()}>Symbole</th>
                <th style={thtd()}>Side</th>
                <th style={thtd()}>Prix</th>
                <th style={thtd()}>24h %</th>
                <th style={thtd()}>Score</th>
                <th style={thtd()}>Créé</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 ? (
                <tr><td style={thtd()} colSpan={6}>Aucun signal</td></tr>
              ) : (
                signals.map((s, i) => (
                  <tr key={`${s.symbol}-${s.created_at}-${i}`}>
                    <td style={thtd()}>{s.symbol}</td>
                    <td style={thtd()}><span style={badgeStyle(s.side)}>{s.side.toUpperCase()}</span></td>
                    <td style={thtd()}>{s.price}</td>
                    <td style={{ ...thtd(), color: pnlColor(s.change_24h) }}>{s.change_24h}</td>
                    <td style={thtd()}>{s.score}</td>
                    <td style={thtd()}>{formatTs(s.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section style={cardStyle()}>
          <h2>Tous les trades</h2>
          <pre style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto" }}>
            {JSON.stringify(trades, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
