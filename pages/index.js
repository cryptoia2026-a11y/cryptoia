import { useEffect, useMemo, useState } from "react";

const API_BASE = "https://cryptoia-api.onrender.com";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [state, setState] = useState(null);
  const [signals, setSignals] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  async function refreshAll() {
    setLoading(true);

    try {
      const [configRes, stateRes, signalsRes, tradesRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/config`),
        fetch(`${API_BASE}/api/v1/state`),
        fetch(`${API_BASE}/api/v1/signals`),
        fetch(`${API_BASE}/api/v1/trades`),
      ]);

      if (!configRes.ok || !stateRes.ok || !signalsRes.ok || !tradesRes.ok) {
        throw new Error("Une ou plusieurs requêtes API ont échoué.");
      }

      const configData = await configRes.json();
      const stateData = await stateRes.json();
      const signalsData = await signalsRes.json();
      const tradesData = await tradesRes.json();

      setConfig(configData);
      setState(stateData);
      setSignals(signalsData.items || []);
      setTrades(tradesData.items || []);
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

  async function startBot() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/bot/start`, { method: "POST" });
      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Impossible de démarrer le bot.");
      }

      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de démarrer le bot.");
    }
  }

  async function stopBot() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/bot/stop`, { method: "POST" });
      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Impossible d'arrêter le bot.");
      }

      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'arrêter le bot.");
    }
  }

  async function tickBot() {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/bot/tick`, { method: "POST" });
      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Impossible de lancer un tick.");
      }

      await refreshAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible de lancer un tick.");
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
      <h1 style={{ marginBottom: 8 }}>MEXC AI Trading Bot v3.1</h1>
      <p style={{ marginTop: 0 }}>
        Dashboard web simple pour paper trading et contrôle du bot.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button onClick={startBot}>Démarrer</button>
        <button onClick={stopBot}>Arrêter</button>
        <button onClick={tickBot}>Lancer un tick</button>
        <button onClick={refreshAll}>Rafraîchir</button>
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
          <span
            style={{
              color: state?.running ? "#5df28c" : "#ff9b9b",
              fontWeight: "bold",
            }}
          >
            {botStatus}
          </span>
        </div>

        <div>
          <strong>Dernière mise à jour:</strong> {lastUpdatedText}
        </div>

        <div>
          <strong>Chargement:</strong> {loading ? "oui" : "non"}
        </div>

        {state?.tick_count !== undefined && (
          <div>
            <strong>Nombre de ticks:</strong> {state.tick_count}
          </div>
        )}

        {state?.open_positions !== undefined && (
          <div>
            <strong>Positions ouvertes:</strong> {state.open_positions}
          </div>
        )}
      </div>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <section
          style={{
            background: "#0d1f44",
            padding: 20,
            borderRadius: 16,
          }}
        >
          <h2>Configuration</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(config, null, 2)}
          </pre>
        </section>

        <section
          style={{
            background: "#0d1f44",
            padding: 20,
            borderRadius: 16,
          }}
        >
          <h2>État</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(state, null, 2)}
          </pre>
        </section>

        <section
          style={{
            background: "#0d1f44",
            padding: 20,
            borderRadius: 16,
          }}
        >
          <h2>Signaux</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(signals, null, 2)}
          </pre>
        </section>

        <section
          style={{
            background: "#0d1f44",
            padding: 20,
            borderRadius: 16,
          }}
        >
          <h2>Trades</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(trades, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
