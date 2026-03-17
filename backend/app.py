from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random
import time
from typing import Dict, List

app = FastAPI(title="MEXC AI Bot Backend v3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT"]

bot_state = {
    "running": False,
    "mode": "paper",
    "equity_usd": 1000.0,
    "max_open_positions": 3,
    "risk_per_trade_pct": 0.5,
    "symbols": SYMBOLS,
    "tick_count": 0,
}

market_state: Dict[str, Dict] = {
    "BTC/USDT": {"price": 65000.0, "trend": 0.35, "volatility": 0.9, "volume": 1.2},
    "ETH/USDT": {"price": 3200.0, "trend": 0.20, "volatility": 1.1, "volume": 1.0},
    "SOL/USDT": {"price": 145.0, "trend": 0.45, "volatility": 1.4, "volume": 1.3},
    "XRP/USDT": {"price": 0.62, "trend": -0.10, "volatility": 1.2, "volume": 0.9},
}

signals: List[Dict] = []
trades: List[Dict] = []


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def update_market() -> None:
    for symbol, data in market_state.items():
        drift = data["trend"] * random.uniform(0.1, 0.6)
        shock = random.uniform(-1.0, 1.0) * data["volatility"]
        pct_move = (drift + shock) / 100.0
        data["price"] = round(max(0.0001, data["price"] * (1 + pct_move)), 6)

        data["trend"] = clamp(data["trend"] + random.uniform(-0.12, 0.12), -1.0, 1.0)
        data["volatility"] = clamp(data["volatility"] + random.uniform(-0.08, 0.08), 0.4, 2.0)
        data["volume"] = clamp(data["volume"] + random.uniform(-0.15, 0.15), 0.5, 2.0)


def score_symbol(symbol: str) -> Dict:
    data = market_state[symbol]
    trend_score = (data["trend"] + 1) / 2
    volume_score = clamp(data["volume"] / 2, 0.0, 1.0)
    volatility_penalty = abs(data["volatility"] - 1.0)
    quality_score = clamp((trend_score * 0.55) + (volume_score * 0.35) - (volatility_penalty * 0.12), 0.0, 1.0)

    side = "flat"
    if quality_score >= 0.68:
        side = "long" if data["trend"] >= 0 else "short"
    elif quality_score >= 0.56 and abs(data["trend"]) > 0.25:
        side = "long" if data["trend"] >= 0 else "short"

    return {
        "symbol": symbol,
        "price": data["price"],
        "trend": round(data["trend"], 3),
        "volatility": round(data["volatility"], 3),
        "volume": round(data["volume"], 3),
        "score": round(quality_score, 3),
        "side": side,
    }


def get_open_positions_count() -> int:
    return sum(1 for t in trades if t["status"] == "open")


def has_open_trade_for_symbol(symbol: str) -> bool:
    return any(t for t in trades if t["symbol"] == symbol and t["status"] == "open")


def create_trade(candidate: Dict) -> Dict:
    risk_usd = bot_state["equity_usd"] * (bot_state["risk_per_trade_pct"] / 100.0)
    entry = candidate["price"]

    if candidate["side"] == "long":
        stop = round(entry * 0.992, 6)
        take_profit = round(entry * 1.016, 6)
    else:
        stop = round(entry * 1.008, 6)
        take_profit = round(entry * 0.984, 6)

    trade = {
        "id": f"trade_{int(time.time() * 1000)}_{random.randint(100,999)}",
        "symbol": candidate["symbol"],
        "side": candidate["side"],
        "entry": entry,
        "stop_loss": stop,
        "take_profit": take_profit,
        "risk_usd": round(risk_usd, 2),
        "score": candidate["score"],
        "status": "open",
        "opened_at": int(time.time()),
    }
    return trade


def manage_open_trades() -> List[Dict]:
    closed = []

    for trade in trades:
        if trade["status"] != "open":
            continue

        price = market_state[trade["symbol"]]["price"]
        side = trade["side"]

        if side == "long":
            hit_stop = price <= trade["stop_loss"]
            hit_tp = price >= trade["take_profit"]
            pnl = (price - trade["entry"]) / trade["entry"] * trade["risk_usd"] * 8
        else:
            hit_stop = price >= trade["stop_loss"]
            hit_tp = price <= trade["take_profit"]
            pnl = (trade["entry"] - price) / trade["entry"] * trade["risk_usd"] * 8

        if hit_stop or hit_tp:
            trade["status"] = "closed"
            trade["exit"] = round(price, 6)
            trade["closed_at"] = int(time.time())
            trade["pnl_usd"] = round(pnl, 2)
            trade["result"] = "win" if hit_tp else "loss"
            bot_state["equity_usd"] = round(bot_state["equity_usd"] + trade["pnl_usd"], 2)
            closed.append(trade)

    return closed


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
        "risk_per_trade_pct": bot_state["risk_per_trade_pct"],
        "symbols": bot_state["symbols"],
    }


@app.get("/api/v1/state")
def get_state():
    return {
        "running": bot_state["running"],
        "mode": bot_state["mode"],
        "equity_usd": bot_state["equity_usd"],
        "tick_count": bot_state["tick_count"],
        "open_positions": get_open_positions_count(),
        "market": market_state,
    }


@app.get("/api/v1/signals")
def get_signals():
    return {"items": signals[:20]}


@app.get("/api/v1/trades")
def get_trades():
    return {"items": trades[:20]}


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

    bot_state["tick_count"] += 1
    update_market()
    closed_trades = manage_open_trades()

    ranked = [score_symbol(sym) for sym in SYMBOLS]
    ranked.sort(key=lambda x: x["score"], reverse=True)

    new_signals = []
    opened_trade = None

    for candidate in ranked:
        if candidate["side"] == "flat":
            continue
        if get_open_positions_count() >= bot_state["max_open_positions"]:
            break
        if has_open_trade_for_symbol(candidate["symbol"]):
            continue

        signal = {
            "symbol": candidate["symbol"],
            "side": candidate["side"],
            "score": candidate["score"],
            "price": candidate["price"],
            "trend": candidate["trend"],
            "volatility": candidate["volatility"],
            "volume": candidate["volume"],
            "reason": "trend/volume/volatility ranking",
            "created_at": int(time.time()),
        }
        signals.insert(0, signal)
        new_signals.append(signal)

        if candidate["score"] >= 0.62:
            opened_trade = create_trade(candidate)
            trades.insert(0, opened_trade)
            break

    return {
        "ok": True,
        "tick_count": bot_state["tick_count"],
        "ranked": ranked,
        "new_signals": new_signals,
        "opened_trade": opened_trade,
        "closed_trades": closed_trades,
        "equity_usd": bot_state["equity_usd"],
    }
