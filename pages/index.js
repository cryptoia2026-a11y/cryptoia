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
  const [autoInterval, setAutoInterval] = useState(30);

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

      if (configData?.auto_interval_seconds) {
        setAutoInterval(configData.auto_interval_seconds);
      }

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

  async function callPost(url, fallbackMessage, body = null) {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
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

  async function autoStart() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/bot/auto-start`, "Impossible d'activer l'auto mode.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'activer l'auto mode.");
    }
  }

  async function autoStop() {
    setError("");
    try {
      await callPost(`${API_BASE}/api/v1/bot/auto-stop`, "Impossible de désactiver l'auto mode.");
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de désactiver l'auto mode.");
    }
  }

  async function saveInterval() {
    setError("");
    try {
      await callPost(
        `${API_BASE}/api/v1/bot/set-interval`,
        "Impossible de changer l'intervalle.",
        { seconds: Number(autoInterval) }
      );
      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de changer l'intervalle.");
    }
  }

  async function autoPulse() {
    try {
      await fetch(`${API_BASE}/api/v1/bot/auto-pulse`, { method: "POST" });
      await refreshAll();
    } catch (err) {
      console.error(err);
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (state?.running && state?.auto_enabled) {
        autoPulse();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [state?.running, state?.auto_enabled]);

  const botStatus = useMemo(() => {
    if (!state) return "inconnu";
    return state.running ? "en marche" : "arrêté";
  }, [state]);

  const autoStatus = useMemo(() => {
    if (!state) return "off";
    return state.auto_enabled ? "AUTO ON" : "AUTO OFF";
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
      <h1 style={{ marginBottom: 8 }}>MEXC AI Trading Bot v7 Auto Pilot</h1>
      <p style={{ marginTop: 0 }}>
        Tick manuel + mode automatique périodique en paper trading.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={startBot}>Démarrer</button>
        <button onClick={stopBot}>Arrêter</button>
        <button onClick={tickBot}>Lancer un tick</button>
        <button onClick={refreshAll}>Rafraîchir</button>
        <button onClick={forceMarketRefresh}>Forcer refresh marché</button>
        <button onClick={resetPaperAccount}>Reset paper account</button>
        <button onClick={autoStart}>Auto ON</button>
        <button onClick={autoStop}>Auto OFF</button>
      </div>

      <div style={{ ...cardStyle(), marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <strong>Statut du bot:</strong>{" "}
            <span style={{ color: state?.running ? "#5df28c" : "#ff9b9b", fontWeight: "bold" }}>
              {botStatus}
            </span>
          </div>

          <div>
            <strong>Mode auto:</strong>{" "}
            <span
              style={{
                color: state?.auto_enabled ? "#5df28c" : "#ff9b9b",
                fontWeight: "bold",
              }}
            >
              {autoStatus}
            </span>
          </div>

          <div><strong>Dernière mise à jour:</strong> {lastUpdatedText}</div>
          <div><strong>Chargement:</strong> {loading ? "oui" : "non"}</div>
          <div><strong>Ticks:</strong> {state?.tick_count ?? 0}</div>
          <div><strong>Positions ouvertes:</strong> {state?.open_positions ?? 0}</div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label>
            <strong>Intervalle auto (sec): </strong>
            <input
              type="number"
              min="10"
              max="300"
              value={autoInterval}
              onChange={(e) => setAutoInterval(e.target.value)}
              style={{ marginLeft: 8, padding: 6, borderRadius: 8, width: 90 }}
            />
          </label>
          <button onClick={saveInterval}>Enregistrer intervalle</button>
          <div>
            <strong>Intervalle actuel:</strong> {state?.auto_interval_seconds ?? "-"} sec
          </div>
        </div>
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
