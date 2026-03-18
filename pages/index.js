import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://cryptoia-api.onrender.com";

function badgeStyle(type) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: "999px",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.3px",
    minWidth: 56,
    border: "1px solid rgba(255,255,255,0.08)",
  };

  if (type === "long") return { ...base, background: "rgba(34,197,94,0.18)", color: "#86efac" };
  if (type === "short") return { ...base, background: "rgba(239,68,68,0.18)", color: "#fca5a5" };
  if (type === "high") return { ...base, background: "rgba(34,197,94,0.18)", color: "#86efac" };
  if (type === "medium") return { ...base, background: "rgba(245,158,11,0.18)", color: "#fcd34d" };
  if (type === "low") return { ...base, background: "rgba(148,163,184,0.18)", color: "#cbd5e1" };
  if (type === "win") return { ...base, background: "rgba(34,197,94,0.18)", color: "#86efac" };
  if (type === "loss") return { ...base, background: "rgba(239,68,68,0.18)", color: "#fca5a5" };
  if (type === "yes") return { ...base, background: "rgba(34,197,94,0.18)", color: "#86efac" };
  if (type === "no") return { ...base, background: "rgba(239,68,68,0.18)", color: "#fca5a5" };
  if (type === "bullish") return { ...base, background: "rgba(34,197,94,0.18)", color: "#86efac" };
  if (type === "bearish") return { ...base, background: "rgba(239,68,68,0.18)", color: "#fca5a5" };
  if (type === "neutral") return { ...base, background: "rgba(148,163,184,0.18)", color: "#cbd5e1" };

  return { ...base, background: "rgba(255,255,255,0.08)", color: "#fff" };
}

function pnlColor(value) {
  const n = Number(value || 0);
  if (n > 0) return "#4ade80";
  if (n < 0) return "#f87171";
  return "#ffffff";
}

function formatTs(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("fr-CA");
}

function fmtNum(v, digits = 4) {
  const n = Number(v ?? 0);
  return n.toFixed(digits);
}

function surfaceStyle() {
  return {
    background: "linear-gradient(180deg, rgba(13,31,68,0.95) 0%, rgba(10,24,54,0.98) 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
    backdropFilter: "blur(8px)",
  };
}

function statCardStyle() {
  return {
    background: "linear-gradient(180deg, rgba(16,37,80,0.95) 0%, rgba(10,24,54,0.98) 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 22,
    boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
    minHeight: 110,
  };
}

function tableStyle() {
  return {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  };
}

function thStyle() {
  return {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.3px",
    position: "sticky",
    top: 0,
    background: "rgba(13,31,68,0.98)",
    zIndex: 1,
  };
}

function tdStyle() {
  return {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    verticalAlign: "top",
  };
}

function buttonStyle(kind = "default") {
  const common = {
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 800,
    fontSize: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    color: "#fff",
  };

  if (kind === "green") {
    return {
      ...common,
      background: "linear-gradient(180deg, #16a34a 0%, #15803d 100%)",
    };
  }

  if (kind === "red") {
    return {
      ...common,
      background: "linear-gradient(180deg, #dc2626 0%, #991b1b 100%)",
    };
  }

  if (kind === "gold") {
    return {
      ...common,
      background: "linear-gradient(180deg, #d97706 0%, #92400e 100%)",
    };
  }

  return {
    ...common,
    background: "linear-gradient(180deg, #1e3a8a 0%, #172554 100%)",
  };
}

export default function Home() {
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [signals, setSignals] = useState([]);
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
        openTradesRes,
        closedTradesRes,
        statsRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/api/v1/config`),
        fetch(`${API_BASE}/api/v1/state`),
        fetch(`${API_BASE}/api/v1/signals`),
        fetch(`${API_BASE}/api/v1/open-trades`),
        fetch(`${API_BASE}/api/v1/closed-trades`),
        fetch(`${API_BASE}/api/v1/stats`),
      ]);

      if (
        !configRes.ok ||
        !stateRes.ok ||
        !signalsRes.ok ||
        !openTradesRes.ok ||
        !closedTradesRes.ok ||
        !statsRes.ok
      ) {
        throw new Error("Une ou plusieurs requêtes API ont échoué.");
      }

      const configData = await configRes.json();
      const stateData = await stateRes.json();
      const signalsData = await signalsRes.json();
      const openTradesData = await openTradesRes.json();
      const closedTradesData = await closedTradesRes.json();
      const statsData = await statsRes.json();

      setConfig(configData);
      setState(stateData);
      setSignals(signalsData.items || []);
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
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/bot/start`, "Impossible de démarrer le bot.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible de démarrer le bot.");
    }
  }

  async function stopBot() {
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/bot/stop`, "Impossible d'arrêter le bot.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible d'arrêter le bot.");
    }
  }

  async function tickBot() {
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/bot/tick`, "Impossible de lancer un tick.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible de lancer un tick.");
    }
  }

  async function forceMarketRefresh() {
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/market/refresh`, "Impossible de forcer le refresh marché.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible de forcer le refresh marché.");
    }
  }

  async function resetPaperAccount() {
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/bot/reset`, "Impossible de reset le paper account.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible de reset le paper account.");
    }
  }

  async function autoStart() {
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/bot/auto-start`, "Impossible d'activer l'auto mode.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible d'activer l'auto mode.");
    }
  }

  async function autoStop() {
    try {
      setError("");
      await callPost(`${API_BASE}/api/v1/bot/auto-stop`, "Impossible de désactiver l'auto mode.");
      await refreshAll();
    } catch (err) {
      setError(err.message || "Impossible de désactiver l'auto mode.");
    }
  }

  async function saveInterval() {
    try {
      setError("");
      await callPost(
        `${API_BASE}/api/v1/bot/set-interval`,
        "Impossible de changer l'intervalle.",
        { seconds: Number(autoInterval) }
      );
      await refreshAll();
    } catch (err) {
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

  const marketRows = useMemo(() => {
    if (!state?.market) return [];
    return Object.entries(state.market)
      .map(([symbol, data]) => ({ symbol, ...data }))
      .filter((row) => Number(row.price) > 0)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }, [state]);

  const cooldownMap = state?.cooldowns || {};
  const marketRegime = state?.market_regime || {};

  const topSignals = signals.slice(0, 10);
  const topClosedTrades = closedTrades.slice(0, 12);

  return (
    <main
      style={{
        minHeight: "100vh",
        color: "white",
        padding: 26,
        fontFamily: "Inter, Arial, sans-serif",
        background:
          "radial-gradient(circle at top left, rgba(30,64,175,0.22), transparent 28%), radial-gradient(circle at top right, rgba(8,145,178,0.16), transparent 25%), linear-gradient(180deg, #041021 0%, #06142b 45%, #07182f 100%)",
      }}
    >
      <div style={{ maxWidth: 1650, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1.04, fontWeight: 900 }}>
            MEXC AI Trading Bot v10 Smart Risk
          </h1>
          <p style={{ marginTop: 12, color: "#cbd5e1", fontSize: 21 }}>
            Break-even, trailing stop, filtre marché global et journal enrichi.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <button style={buttonStyle("green")} onClick={startBot}>Démarrer</button>
          <button style={buttonStyle("red")} onClick={stopBot}>Arrêter</button>
          <button style={buttonStyle()} onClick={tickBot}>Lancer un tick</button>
          <button style={buttonStyle()} onClick={refreshAll}>Rafraîchir</button>
          <button style={buttonStyle()} onClick={forceMarketRefresh}>Forcer refresh marché</button>
          <button style={buttonStyle("gold")} onClick={resetPaperAccount}>Reset paper account</button>
          <button style={buttonStyle("green")} onClick={autoStart}>Auto ON</button>
          <button style={buttonStyle("red")} onClick={autoStop}>Auto OFF</button>
        </div>

        <div style={{ ...surfaceStyle(), marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: 16,
            }}
          >
            <div><strong>Statut du bot:</strong> <span style={{ color: state?.running ? "#4ade80" : "#f87171", fontWeight: 900 }}>{botStatus}</span></div>
            <div><strong>Mode auto:</strong> <span style={{ color: state?.auto_enabled ? "#4ade80" : "#f87171", fontWeight: 900 }}>{autoStatus}</span></div>
            <div><strong>Dernière mise à jour:</strong> {lastUpdatedText}</div>
            <div><strong>Chargement:</strong> {loading ? "oui" : "non"}</div>
            <div><strong>Ticks:</strong> {state?.tick_count ?? 0}</div>
            <div><strong>Positions ouvertes:</strong> {state?.open_positions ?? 0}</div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
              Intervalle auto (sec):
              <input
                type="number"
                min="10"
                max="300"
                value={autoInterval}
                onChange={(e) => setAutoInterval(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 12,
                  width: 92,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "#0b1730",
                  color: "#fff",
                  fontWeight: 700,
                }}
              />
            </label>
            <button style={buttonStyle()} onClick={saveInterval}>Enregistrer intervalle</button>
            <div><strong>Intervalle actuel:</strong> {state?.auto_interval_seconds ?? "-"} sec</div>
            <div><strong>Régime:</strong> <span style={badgeStyle(marketRegime.regime)}>{String(marketRegime.regime || "neutral").toUpperCase()}</span></div>
            <div><strong>Nouveaux trades autorisés:</strong> <span style={badgeStyle(marketRegime.allow_new_trades ? "yes" : "no")}>{marketRegime.allow_new_trades ? "OUI" : "NON"}</span></div>
          </div>
        </div>

        {stats && (
          <div
            style={{
              marginBottom: 18,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 14,
            }}
          >
            {[
              ["Capital départ", stats.starting_equity_usd, "#fff"],
              ["Capital actuel", stats.equity_usd, "#fff"],
              ["PnL réalisé", stats.realized_pnl_usd, pnlColor(stats.realized_pnl_usd)],
              ["PnL non réalisé", stats.unrealized_pnl_usd, pnlColor(stats.unrealized_pnl_usd)],
              ["PnL total", stats.total_pnl_usd, pnlColor(stats.total_pnl_usd)],
              ["Wins", stats.wins, "#4ade80"],
              ["Losses", stats.losses, "#f87171"],
              ["Win rate", `${stats.win_rate_pct}%`, "#fff"],
            ].map(([label, value, color]) => (
              <div key={label} style={statCardStyle()}>
                <div style={{ color: "#9fb3d1", marginBottom: 12, fontSize: 15, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 25, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 16,
              background: "rgba(127,29,29,0.55)",
              color: "#fecaca",
              whiteSpace: "pre-wrap",
              border: "1px solid rgba(248,113,113,0.25)",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
          <section style={surfaceStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Marché valide</h2>
            <div style={{ maxHeight: 420, overflow: "auto", borderRadius: 16 }}>
              <table style={tableStyle()}>
                <thead>
                  <tr>
                    <th style={thStyle()}>Symbole</th>
                    <th style={thStyle()}>Prix</th>
                    <th style={thStyle()}>24h %</th>
                    <th style={thStyle()}>Volume</th>
                    <th style={thStyle()}>Score</th>
                    <th style={thStyle()}>Qualité</th>
                    <th style={thStyle()}>Cooldown</th>
                  </tr>
                </thead>
                <tbody>
                  {marketRows.length === 0 ? (
                    <tr><td style={tdStyle()} colSpan={7}>Aucune donnée marché valide</td></tr>
                  ) : (
                    marketRows.map((row) => {
                      const onCooldown = cooldownMap[row.symbol] && Date.now() / 1000 < cooldownMap[row.symbol];
                      return (
                        <tr key={row.symbol}>
                          <td style={tdStyle()}>{row.symbol}</td>
                          <td style={tdStyle()}>{row.price}</td>
                          <td style={{ ...tdStyle(), color: pnlColor(row.change_24h), fontWeight: 800 }}>{row.change_24h}</td>
                          <td style={tdStyle()}>{row.volume}</td>
                          <td style={tdStyle()}>{row.score}</td>
                          <td style={tdStyle()}><span style={badgeStyle(row.quality)}>{String(row.quality || "").toUpperCase()}</span></td>
                          <td style={tdStyle()}><span style={badgeStyle(onCooldown ? "yes" : "no")}>{onCooldown ? "OUI" : "NON"}</span></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={surfaceStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>État</h2>
            <pre style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto", margin: 0, color: "#dbeafe" }}>
              {JSON.stringify(state, null, 2)}
            </pre>
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <section style={surfaceStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Positions ouvertes</h2>
            <div style={{ maxHeight: 420, overflow: "auto", borderRadius: 16 }}>
              <table style={tableStyle()}>
                <thead>
                  <tr>
                    <th style={thStyle()}>Symbole</th>
                    <th style={thStyle()}>Side</th>
                    <th style={thStyle()}>Entrée</th>
                    <th style={thStyle()}>SL</th>
                    <th style={thStyle()}>TP</th>
                    <th style={thStyle()}>Prix actuel</th>
                    <th style={thStyle()}>PnL flottant</th>
                    <th style={thStyle()}>R</th>
                    <th style={thStyle()}>BE</th>
                    <th style={thStyle()}>Trail</th>
                    <th style={thStyle()}>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.length === 0 ? (
                    <tr><td style={tdStyle()} colSpan={11}>Aucune position ouverte</td></tr>
                  ) : (
                    openTrades.map((t) => (
                      <tr key={t.id}>
                        <td style={tdStyle()}>{t.symbol}</td>
                        <td style={tdStyle()}><span style={badgeStyle(t.side)}>{t.side.toUpperCase()}</span></td>
                        <td style={tdStyle()}>{t.entry}</td>
                        <td style={tdStyle()}>{t.stop_loss}</td>
                        <td style={tdStyle()}>{t.take_profit}</td>
                        <td style={tdStyle()}>{t.current_price}</td>
                        <td style={{ ...tdStyle(), color: pnlColor(t.unrealized_pnl_usd), fontWeight: 800 }}>{fmtNum(t.unrealized_pnl_usd)}</td>
                        <td style={{ ...tdStyle(), color: pnlColor(t.r_multiple), fontWeight: 800 }}>{fmtNum(t.r_multiple)}</td>
                        <td style={tdStyle()}><span style={badgeStyle(t.moved_to_break_even ? "yes" : "no")}>{t.moved_to_break_even ? "OUI" : "NON"}</span></td>
                        <td style={tdStyle()}><span style={badgeStyle(t.trailing_active ? "yes" : "no")}>{t.trailing_active ? "OUI" : "NON"}</span></td>
                        <td style={tdStyle()}>{t.duration_text || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={surfaceStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Trades fermés</h2>
            <div style={{ maxHeight: 420, overflow: "auto", borderRadius: 16 }}>
              <table style={tableStyle()}>
                <thead>
                  <tr>
                    <th style={thStyle()}>Symbole</th>
                    <th style={thStyle()}>Side</th>
                    <th style={thStyle()}>Résultat</th>
                    <th style={thStyle()}>Raison</th>
                    <th style={thStyle()}>PnL</th>
                    <th style={thStyle()}>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {topClosedTrades.length === 0 ? (
                    <tr><td style={tdStyle()} colSpan={6}>Aucun trade fermé</td></tr>
                  ) : (
                    topClosedTrades.map((t) => (
                      <tr key={t.id}>
                        <td style={tdStyle()}>{t.symbol}</td>
                        <td style={tdStyle()}><span style={badgeStyle(t.side)}>{t.side.toUpperCase()}</span></td>
                        <td style={tdStyle()}><span style={badgeStyle(t.result)}>{String(t.result || "").toUpperCase()}</span></td>
                        <td style={tdStyle()}>{t.close_reason || "-"}</td>
                        <td style={{ ...tdStyle(), color: pnlColor(t.pnl_usd), fontWeight: 800 }}>{fmtNum(t.pnl_usd)}</td>
                        <td style={tdStyle()}>{t.duration_text || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          <section style={surfaceStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Signaux récents</h2>
            <div style={{ maxHeight: 420, overflow: "auto", borderRadius: 16 }}>
              <table style={tableStyle()}>
                <thead>
                  <tr>
                    <th style={thStyle()}>Symbole</th>
                    <th style={thStyle()}>Side</th>
                    <th style={thStyle()}>24h %</th>
                    <th style={thStyle()}>Score</th>
                    <th style={thStyle()}>Qualité</th>
                    <th style={thStyle()}>Raison</th>
                    <th style={thStyle()}>Créé</th>
                  </tr>
                </thead>
                <tbody>
                  {topSignals.length === 0 ? (
                    <tr><td style={tdStyle()} colSpan={7}>Aucun signal</td></tr>
                  ) : (
                    topSignals.map((s, i) => (
                      <tr key={`${s.symbol}-${s.created_at}-${i}`}>
                        <td style={tdStyle()}>{s.symbol}</td>
                        <td style={tdStyle()}><span style={badgeStyle(s.side)}>{s.side.toUpperCase()}</span></td>
                        <td style={{ ...tdStyle(), color: pnlColor(s.change_24h), fontWeight: 800 }}>{s.change_24h}</td>
                        <td style={tdStyle()}>{s.score}</td>
                        <td style={tdStyle()}><span style={badgeStyle(s.quality)}>{String(s.quality || "").toUpperCase()}</span></td>
                        <td style={tdStyle()}>{s.reason || "-"}</td>
                        <td style={tdStyle()}>{formatTs(s.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={surfaceStyle()}>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>Configuration</h2>
            <pre style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto", margin: 0, color: "#dbeafe" }}>
              {JSON.stringify(config, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </main>
  );
}
