import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Home() {
  const [state, setState] = useState(null);
  const [config, setConfig] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);

  const load = async () => {
    const [s, c, g, t] = await Promise.all([
      fetch(`${API}/api/v1/state`).then(r => r.json()),
      fetch(`${API}/api/v1/config`).then(r => r.json()),
      fetch(`${API}/api/v1/signals`).then(r => r.json()),
      fetch(`${API}/api/v1/trades`).then(r => r.json()),
    ]);
    setState(s);
    setConfig(c);
    setSignals(g);
    setTrades(t);
  };

  useEffect(() => { load(); }, []);

  const post = async (path) => {
    await fetch(`${API}${path}`, { method: "POST" });
    await load();
  };

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24, background: "#0b1220", color: "#e5eefc", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 4 }}>MEXC AI Trading Bot v2</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>Dashboard web simple pour paper trading et contrôle du bot.</p>

      <div style={{ display: "flex", gap: 12, margin: "16px 0 24px" }}>
        <button onClick={() => post("/api/v1/bot/start")}>Démarrer</button>
        <button onClick={() => post("/api/v1/bot/stop")}>Arrêter</button>
        <button onClick={() => post("/api/v1/bot/tick")}>Lancer un tick</button>
        <button onClick={load}>Rafraîchir</button>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {state && [
          ["Mode", state.mode],
          ["Equity", `$${state.equity_usd}`],
          ["PnL jour", `$${state.daily_pnl_usd}`],
          ["Positions ouvertes", state.open_positions],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "#121c31", borderRadius: 12, padding: 16 }}>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#121c31", borderRadius: 12, padding: 16 }}>
          <h2>Configuration</h2>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
        <div style={{ background: "#121c31", borderRadius: 12, padding: 16 }}>
          <h2>État</h2>
          <pre>{JSON.stringify(state, null, 2)}</pre>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={{ background: "#121c31", borderRadius: 12, padding: 16 }}>
          <h2>Signaux</h2>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            {signals.map((s, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #24314d" }}>
                <strong>{s.symbol}</strong> — {s.side} — score {s.score} — prix {s.price}
                <div style={{ opacity: 0.75, fontSize: 13 }}>{s.reason}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#121c31", borderRadius: 12, padding: 16 }}>
          <h2>Trades</h2>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            {trades.map((t, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid #24314d" }}>
                <strong>{t.symbol}</strong> — {t.side} — {t.status}
                <div style={{ opacity: 0.75, fontSize: 13 }}>
                  entrée {t.entry_price} | TP {t.take_profit} | SL {t.stop_loss} | taille ${t.size_usd} | pnl ${t.pnl_usd}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
