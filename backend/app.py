from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MEXC AI Bot Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bot_state = {
    "running": False,
    "mode": "paper",
    "equity_usd": 1000,
    "max_open_positions": 3,
    "symbols": ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT"],
}

signals = []
trades = []

@app.get("/")
def root():
    return {"message": "Backend online"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/v1/config")
def get_config():
    return {
        "mode": bot_state["mode"],
        "equity_usd": bot_state["equity_usd"],
        "max_open_positions": bot_state["max_open_positions"],
        "symbols": bot_state["symbols"],
    }

@app.get("/api/v1/state")
def get_state():
    return {
        "running": bot_state["running"],
        "mode": bot_state["mode"],
        "equity_usd": bot_state["equity_usd"],
    }

@app.get("/api/v1/signals")
def get_signals():
    return {"items": signals}

@app.get("/api/v1/trades")
def get_trades():
    return {"items": trades}

@app.post("/api/v1/bot/start")
def start_bot():
    bot_state["running"] = True
    return {"ok": True, "running": True}

@app.post("/api/v1/bot/stop")
def stop_bot():
    bot_state["running"] = False
    return {"ok": True, "running": False}

@app.post("/api/v1/bot/tick")
def tick_bot():
    if not bot_state["running"]:
        return {"ok": False, "message": "Bot not running"}

    signal = {
        "symbol": "BTC/USDT",
        "side": "long",
        "score": 0.78,
        "reason": "paper tick generated"
    }
    trade = {
        "symbol": "BTC/USDT",
        "side": "long",
        "entry": 65000,
        "status": "open"
    }

    signals.insert(0, signal)
    trades.insert(0, trade)

    return {"ok": True, "signal": signal, "trade": trade}