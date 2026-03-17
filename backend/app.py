from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time
from typing import Dict, List
import httpx

app = FastAPI(title="MEXC AI Bot Backend v4")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT"]

COINGECKO_IDS = {
    "BTC/USDT": "bitcoin",
    "ETH/USDT": "ethereum",
    "SOL/USDT": "solana",
    "XRP/USDT": "ripple",
}

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
    s: {"price": 0.0, "change_24h": 0.0, "volume": 0.0, "score": 0.0}
    for s in SYMBOLS
}

signals: List[Dict] = []
trades: List[Dict] = []


async def fetch_real_market_data() -> None:
    ids = ",".join(COINGECKO_IDS.values())
    url = "https://api.coingecko.com/api/v3/coins/markets"

    params = {
        "vs_currency": "usd",
        "ids": ids,
        "order": "market_cap_desc",
        "per_page": 10,
        "page": 1,
        "sparkline": "false",
        "price_change_percentage": "24h",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    by_id = {item["id"]: item for item in data}

    for symbol, coin_id in COINGECKO_IDS.items():
        item = by_id.get(coin_id)
        if not item:
            continue

        price = float(item.get("current_price") or 0.0)
        change_24h = float(item.get("price_change_percentage_24h") or 0.0)
        volume = float(item.get("total_volume") or 0.0)

        volume_score = min(volume / 50_000_000_000, 1.0)
        momentum_score = max(min((change_24h + 10) / 20, 1.0), 0.0)
        quality_score = round((momentum_score * 0.7) + (volume_score * 0.3), 3)

        market_state[symbol] = {
            "price": round(price, 6),
            "change_24h": round(change_24h, 3),
            "volume": round(volume, 2),
            "score": quality_score,
        }


def get_open_positions_count() -> int:
    return sum(1 for t in trades if t["status"] == "open")


def has_open_trade_for_symbol(symbol: str) -> bool:
    return any(t for t in trades if t["symbol"] == symbol and t["status"] == "open")


def create_trade(candidate: Dict) -> Dict:
    risk_usd = bot_state["equity_usd"] * (bot_state["risk_per_trade_pct"] / 100.0)
    entry = candidate["price"]
    side = candidate["side"]

    if side == "long":
        stop = round(entry * 0.992, 6)
        take_profit = round(entry * 1.016, 6)
    else:
        stop = round(entry * 1.008, 6)
        take_profit = round(entry * 0.984, 6)

    return {
        "id": f"trade_{int(time.time() * 1000)}",
        "symbol": candidate["symbol"],
        "side": side,
        "entry": entry,
        "stop_loss": stop,
        "take_profit": take_profit,
        "risk_usd": round(risk_usd, 2),
        "score": candidate["score"],
        "status": "open",
        "opened_at": int(time.time()),
    }


def manage_open_trades() -> List[Dict]:
    closed = []

    for trade in trades:
        if trade["status"] != "open":
            continue

        price = market_state[trade["symbol"]]["price"]
        if not price:
            continue

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
async def tick_bot():
    if not bot_state["running"]:
        return {"ok": False, "message": "Bot not running"}

    bot_state["tick_count"] += 1

    await fetch_real_market_data()
    closed_trades = manage_open_trades()

    ranked = []
    for symbol in SYMBOLS:
        data = market_state[symbol]
        if data["price"] <= 0:
            continue

        side = "flat"
        if data["score"] >= 0.58:
            side = "long" if data["change_24h"] >= 0 else "short"

        ranked.append({
            "symbol": symbol,
            "price": data["price"],
            "change_24h": data["change_24h"],
            "volume": data["volume"],
            "score": data["score"],
            "side": side,
        })

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
            "change_24h": candidate["change_24h"],
            "volume": candidate["volume"],
            "reason": "real price momentum + volume ranking",
            "created_at": int(time.time()),
        }
        signals.insert(0, signal)
        new_signals.append(signal)

        if candidate["score"] >= 0.58:
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
