import { useEffect, useState } from "react";

const API_BASE = "https://cryptoia-api.onrender.com";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);

  async function refreshAll() {
    try {
      const [configRes, stateRes, signalsRes, tradesRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/config`),
        fetch(`${API_BASE}/api/v1/state`),
        fetch(`${API_BASE}/api/v1/signals`),
        fetch(`${API_BASE}/api/v1/trades`),
      ]);

      const configData = await configRes.json();
      const stateData = await stateRes.json();
      const signalsData = await signalsRes.json();
      const tradesData = await tradesRes.json();

      setConfig(configData);
      setState(stateData);
      setSignals(signalsData.items || []);
      setTrades(tradesData.items || []);
    } catch (error) {
      console.error("Erreur refreshAll:", error);
    }
  }

  async function startBot() {
    await fetch(`${API_BASE}/api/v1/bot/start`, { method: "POST" });
    await refreshAll();
  }

  async function stopBot() {
    await fetch(`${API_BASE}/api/v1/bot/stop`, { method: "POST" });
    await refreshAll();
  }

  async function tickBot() {
    await fetch(`${API_BASE}/api/v1/bot/tick`, { method: "POST" });
    await refreshAll();
  }

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <main style={{ background: "#06142b", minHeight: "100vh", color: "white", padding: 24 }}>
      <h1>MEXC AI Trading Bot v2</h1>
      <p>Dashboard web simple pour paper trading et contrôle du bot.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button onClick={startBot}>Démarrer</button>
        <button onClick={stopBot}>Arrêter</button>
        <button onClick={tickBot}>Lancer un tick</button>
        <button onClick={refreshAll}>Rafraîchir</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ background: "#0d1f44", padding: 20, borderRadius: 16 }}>
          <h2>Configuration</h2>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </section>

        <section style={{ background: "#0d1f44", padding: 20, borderRadius: 16 }}>
          <h2>État</h2>
          <pre>{JSON.stringify(state, null, 2)}</pre>
        </section>

        <section style={{ background: "#0d1f44", padding: 20, borderRadius: 16 }}>
          <h2>Signaux</h2>
          <pre>{JSON.stringify(signals, null, 2)}</pre>
        </section>

        <section style={{ background: "#0d1f44", padding: 20, borderRadius: 16 }}>
          <h2>Trades</h2>
          <pre>{JSON.stringify(trades, null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}
