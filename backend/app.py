from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import time
from typing import Dict, List
import httpx

app = FastAPI(title="MEXC AI Bot Backend v10.7 Active")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cryptoia-frontend.onrender.com",
        "https://cryptoia-backend.onrender.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DESIRED_SYMBOLS = [
    "BTC/USDT",
    "ETH/USDT",
    "SOL/USDT",
    "XRP/USDT",
    "ADA/USDT",
    "DOGE/USDT",
    "AVAX/USDT",
    "LINK/USDT",
    "DOT/USDT",
    "LTC/USDT",
    "BCH/USDT",
    "UNI/USDT",
    "ATOM/USDT",
    "NEAR/USDT",
    "APT/USDT",
    "ARB/USDT",
    "OP/USDT",
    "INJ/USDT",
    "FIL/USDT",
    "SUI/USDT",
    "SEI/USDT",
    "PEPE/USDT",
    "SHIB/USDT",
    "BONK/USDT",
    "ZEC/USDT",
    "TRUMP/USDT",
    "RIVER/USDT",
    "GRASS/USDT",
]

SYMBOLS = list(DESIRED_SYMBOLS)
KRAKEN_PAIRS: Dict[str, str] = {}

INITIAL_EQUITY = 1000.0
MARKET_CACHE_SECONDS = 30
SYMBOL_COOLDOWN_SECONDS = 240
MIN_VALID_PRICE = 0.00000001

MIN_SCORE_TO_OPEN = 0.50
MAX_RECENT_SAME_SYMBOL_SIGNALS = 1
MAX_NEW_TRADES_PER_10_MIN = 6
RECENT_TRADE_WINDOW_SECONDS = 600

BREAK_EVEN_TRIGGER_R = 0.70
TRAILING_TRIGGER_R = 1.35
TRAILING_LOCK_R = 0.60

MIN_HOLD_SECONDS = 180
TIMED_EXIT_SECONDS = 5400
TIMED_EXIT_MAX_ABS_PNL = 12.0

SIMULATED_LEVERAGE = 10.0

bot_state = {
    "running": False,
    "auto_enabled": False,
    "auto_interval_seconds": 30,
    "last_auto_tick_ts": 0.0,
    "mode": "paper",
    "equity_usd": INITIAL_EQUITY,
    "starting_equity_usd": INITIAL_EQUITY,
    "max_open_positions": 4,
    "risk_per_trade_pct": 5.0,
    "symbols": SYMBOLS,
    "tick_count": 0,
    "last_error": "",
}

market_state: Dict[str, Dict] = {
    s: {
        "price": 0.0,
        "change_24h": 0.0,
        "volume": 0.0,
        "score": 0.0,
        "trend_strength": 0.0,
        "quality": "low",
    }
    for s in SYMBOLS
}

previous_market_state: Dict[str, Dict] = {
    s: {
        "price": 0.0,
        "change_24h": 0.0,
        "volume": 0.0,
        "score": 0.0,
        "trend_strength": 0.0,
        "quality": "low",
    }
    for s in SYMBOLS
}

signals: List[Dict] = []
trades: List[Dict] = []
symbol_cooldowns: Dict[str, int] = {s: 0 for s in SYMBOLS}

last_market_fetch_ts = 0.0


def round_price(value: float) -> float:
    if value < 0.001:
        return round(value, 10)
    if value < 1:
        return round(value, 8)
    return round(value, 6)


def format_duration(seconds: int) -> str:
    seconds = max(0, int(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}h {m}m {s}s"
    if m > 0:
        return f"{m}m {s}s"
    return f"{s}s"


async def refresh_valid_kraken_pairs() -> bool:
    global KRAKEN_PAIRS
    try:
        url = "https://api.kraken.com/0/public/AssetPairs"
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(
                url,
                headers={"accept": "application/json", "user-agent": "cryptoia-bot/1.0"},
            )
            response.raise_for_status()
            payload = response.json()

        if payload.get("error"):
            raise Exception(f"Kraken AssetPairs error: {payload['error']}")

        result = payload.get("result", {})
        discovered = {}

        for _, item in result.items():
            altname = str(item.get("altname", ""))
            wsname = str(item.get("wsname", ""))
            candidate = None

            if wsname.endswith("/USDT"):
                candidate = wsname
            elif altname.endswith("USDT"):
                base = altname[:-4]
                candidate = f"{base}/USDT"

            if candidate and candidate in DESIRED_SYMBOLS:
                discovered[candidate] = altname

        KRAKEN_PAIRS = discovered
        return True

    except Exception as e:
        bot_state["last_error"] = f"refresh_valid_kraken_pairs error: {str(e)}"
        print(bot_state["last_error"])
        return False


async def fetch_real_market_data(force: bool = False) -> bool:
    global last_market_fetch_ts, previous_market_state

    now = time.time()
    if not force and last_market_fetch_ts and (now - last_market_fetch_ts) < MARKET_CACHE_SECONDS:
        return True

    try:
        if not KRAKEN_PAIRS:
            ok_pairs = await refresh_valid_kraken_pairs()
            if not ok_pairs:
                return False

        if not KRAKEN_PAIRS:
            raise Exception("No valid Kraken USDT pairs found")

        pair_list = ",".join(KRAKEN_PAIRS.values())
        url = "https://api.kraken.com/0/public/Ticker"

        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(
                url,
                params={"pair": pair_list},
                headers={"accept": "application/json", "user-agent": "cryptoia-bot/1.0"},
            )
            response.raise_for_status()
            payload = response.json()

        if payload.get("error"):
            raise Exception(f"Kraken error: {payload['error']}")

        result = payload.get("result", {})
        previous_market_state = {k: dict(v) for k, v in market_state.items()}

        for s in DESIRED_SYMBOLS:
            market_state[s] = {
                "price": 0.0,
                "change_24h": 0.0,
                "volume": 0.0,
                "score": 0.0,
                "trend_strength": 0.0,
                "quality": "low",
            }

        for symbol, kraken_pair in KRAKEN_PAIRS.items():
            item = result.get(kraken_pair)
            if not item:
                continue

            price = float(item["c"][0]) if item.get("c") else 0.0
            volume = float(item["v"][1]) if item.get("v") else 0.0
            open_price = float(item["o"]) if item.get("o") else 0.0

            change_24h = ((price - open_price) / open_price * 100.0) if open_price > 0 else 0.0
            abs_change = abs(change_24h)

            momentum_score = max(min((abs_change + 1.0) / 6.0, 1.0), 0.0)
            direction_score = max(min((change_24h + 8.0) / 16.0, 1.0), 0.0)
            volume_score = min(volume / 100000.0, 1.0)
            trend_strength = round(abs_change, 3)

            quality_score = round(
                (momentum_score * 0.46) + (direction_score * 0.14) + (volume_score * 0.40),
                3,
            )

            if quality_score >= 0.72:
                quality = "high"
            elif quality_score >= 0.55:
                quality = "medium"
            else:
                quality = "low"

            market_state[symbol] = {
                "price": round_price(price),
                "change_24h": round(change_24h, 3),
                "volume": round(volume, 2),
                "score": quality_score,
                "trend_strength": trend_strength,
                "quality": quality,
            }

        last_market_fetch_ts = now
        bot_state["last_error"] = ""
        return True

    except Exception as e:
        bot_state["last_error"] = f"fetch_real_market_data error: {str(e)}"
        print(bot_state["last_error"])
        return False


def get_open_positions_count() -> int:
    return sum(1 for t in trades if t["status"] == "open")


def has_open_trade_for_symbol(symbol: str) -> bool:
    return any(t for t in trades if t["symbol"] == symbol and t["status"] == "open")


def is_symbol_on_cooldown(symbol: str) -> bool:
    return int(time.time()) < symbol_cooldowns.get(symbol, 0)


def set_symbol_cooldown(symbol: str) -> None:
    symbol_cooldowns[symbol] = int(time.time()) + SYMBOL_COOLDOWN_SECONDS


def recent_signal_count_for_symbol(symbol: str) -> int:
    return sum(1 for s in signals[:25] if s.get("symbol") == symbol)


def recent_opened_trade_count() -> int:
    now_ts = int(time.time())
    return sum(
        1 for t in trades
        if int(t.get("opened_at", 0)) >= now_ts - RECENT_TRADE_WINDOW_SECONDS
    )


def recent_trade_count_for_symbol(symbol: str, lookback_seconds: int = 3600) -> int:
    now_ts = int(time.time())
    return sum(
        1
        for t in trades
        if t.get("symbol") == symbol and int(t.get("opened_at", 0)) >= now_ts - lookback_seconds
    )


def calc_trade_pnl(price_now: float, trade: Dict) -> float:
    if trade["entry"] <= 0 or price_now <= 0:
        return 0.0
    if trade["side"] == "long":
        return ((price_now - trade["entry"]) / trade["entry"]) * trade["risk_usd"] * SIMULATED_LEVERAGE
    return ((trade["entry"] - price_now) / trade["entry"]) * trade["risk_usd"] * SIMULATED_LEVERAGE


def calc_trade_r(price_now: float, trade: Dict) -> float:
    risk_usd = float(trade.get("risk_usd", 0.0))
    if risk_usd <= 0:
        return 0.0
    pnl = calc_trade_pnl(price_now, trade)
    return pnl / risk_usd


def get_market_regime() -> Dict:
    valid = [market_state[s] for s in SYMBOLS if market_state[s]["price"] > MIN_VALID_PRICE]
    if not valid:
        return {
            "avg_change_24h": 0.0,
            "avg_score": 0.0,
            "bullish_count": 0,
            "bearish_count": 0,
            "regime": "neutral",
            "allow_new_trades": True,
        }

    avg_change = sum(v["change_24h"] for v in valid) / len(valid)
    avg_score = sum(v["score"] for v in valid) / len(valid)
    bullish_count = sum(1 for v in valid if v["change_24h"] > 0)
    bearish_count = sum(1 for v in valid if v["change_24h"] < 0)

    if avg_change >= 0.25 and bullish_count >= bearish_count:
        regime = "bullish"
    elif avg_change <= -0.25 and bearish_count >= bullish_count:
        regime = "bearish"
    else:
        regime = "neutral"

    allow_new_trades = avg_score >= 0.22

    return {
        "avg_change_24h": round(avg_change, 3),
        "avg_score": round(avg_score, 3),
        "bullish_count": bullish_count,
        "bearish_count": bearish_count,
        "regime": regime,
        "allow_new_trades": allow_new_trades,
    }


def enrich_trade_runtime(trade: Dict) -> Dict:
    t = dict(trade)
    now_ts = int(time.time())
    opened_at = int(t.get("opened_at", now_ts))
    closed_at = t.get("closed_at")
    end_ts = int(closed_at) if closed_at else now_ts
    duration_seconds = max(0, end_ts - opened_at)

    t["duration_seconds"] = duration_seconds
    t["duration_text"] = format_duration(duration_seconds)

    if t.get("status") == "open":
        price = market_state.get(t["symbol"], {}).get("price", 0.0)
        unrealized = calc_trade_pnl(price, t)
        t["current_price"] = round_price(price)
        t["unrealized_pnl_usd"] = round(unrealized, 4)
        t["r_multiple"] = round(calc_trade_r(price, t), 4)

    return t


def get_open_trades() -> List[Dict]:
    return [enrich_trade_runtime(t) for t in trades if t["status"] == "open"]


def get_closed_trades() -> List[Dict]:
    return [enrich_trade_runtime(t) for t in trades if t["status"] == "closed"]


def get_stats() -> Dict:
    closed = get_closed_trades()
    open_positions = get_open_trades()

    wins = sum(1 for t in closed if t.get("result") == "win")
    losses = sum(1 for t in closed if t.get("result") == "loss")
    realized = round(sum(float(t.get("pnl_usd", 0.0)) for t in closed), 4)
    unrealized = round(sum(float(t.get("unrealized_pnl_usd", 0.0)) for t in open_positions), 4)

    return {
        "starting_equity_usd": round(bot_state["starting_equity_usd"], 2),
        "equity_usd": round(bot_state["equity_usd"], 4),
        "realized_pnl_usd": realized,
        "unrealized_pnl_usd": unrealized,
        "total_pnl_usd": round(realized + unrealized, 4),
        "wins": wins,
        "losses": losses,
        "closed_trades": len(closed),
        "open_trades": len(open_positions),
        "win_rate_pct": round((wins / len(closed) * 100.0), 2) if closed else 0.0,
    }


def is_continuation_signal(symbol: str, current: Dict, previous: Dict, side: str) -> bool:
    prev_price = float(previous.get("price", 0.0))
    prev_score = float(previous.get("score", 0.0))
    prev_change = float(previous.get("change_24h", 0.0))
    prev_trend = float(previous.get("trend_strength", 0.0))

    if prev_price <= 0:
        return True

    price_delta = (float(current["price"]) - prev_price) / prev_price * 100.0
    score_delta = float(current["score"]) - prev_score
    change_delta = float(current["change_24h"]) - prev_change
    trend_delta = float(current["trend_strength"]) - prev_trend

    if side == "long":
        return (
            price_delta >= -0.70
            and score_delta >= -0.15
            and change_delta >= -0.80
            and trend_delta >= -0.70
        )

    return (
        price_delta <= 0.70
        and score_delta >= -0.15
        and change_delta <= 0.80
        and trend_delta >= -0.70
    )


def create_trade(candidate: Dict) -> Dict:
    risk_usd = bot_state["equity_usd"] * (bot_state["risk_per_trade_pct"] / 100.0)
    entry = candidate["price"]

    if candidate["side"] == "long":
        stop = entry * 0.988
        take_profit = entry * 1.038
    else:
        stop = entry * 1.012
        take_profit = entry * 0.962

    return {
        "id": f"trade_{int(time.time() * 1000)}",
        "symbol": candidate["symbol"],
        "side": candidate["side"],
        "entry": round_price(entry),
        "stop_loss": round_price(stop),
        "take_profit": round_price(take_profit),
        "initial_stop_loss": round_price(stop),
        "initial_take_profit": round_price(take_profit),
        "risk_usd": round(risk_usd, 4),
        "score": candidate["score"],
        "base_score": candidate.get("base_score", candidate["score"]),
        "quality": candidate["quality"],
        "status": "open",
        "opened_at": int(time.time()),
        "entry_reason": candidate.get("reason", ""),
        "moved_to_break_even": False,
        "trailing_active": False,
        "highest_r_seen": 0.0,
    }


def manage_open_trades() -> List[Dict]:
    closed = []

    for trade in trades:
        if trade["status"] != "open":
            continue

        price = market_state[trade["symbol"]]["price"]
        if not price:
            continue

        current_r = calc_trade_r(price, trade)
        trade["highest_r_seen"] = max(float(trade.get("highest_r_seen", 0.0)), current_r)

        if not trade.get("moved_to_break_even") and current_r >= BREAK_EVEN_TRIGGER_R:
            trade["stop_loss"] = trade["entry"]
            trade["moved_to_break_even"] = True

        if current_r >= TRAILING_TRIGGER_R:
            trade["trailing_active"] = True
            if trade["side"] == "long":
                desired_stop = trade["entry"] * (1 + (TRAILING_LOCK_R / SIMULATED_LEVERAGE))
                if desired_stop > trade["stop_loss"]:
                    trade["stop_loss"] = round_price(desired_stop)
            else:
                desired_stop = trade["entry"] * (1 - (TRAILING_LOCK_R / SIMULATED_LEVERAGE))
                if desired_stop < trade["stop_loss"]:
                    trade["stop_loss"] = round_price(desired_stop)

        if trade["side"] == "long":
            hit_stop = price <= trade["stop_loss"]
            hit_tp = price >= trade["take_profit"]
        else:
            hit_stop = price >= trade["stop_loss"]
            hit_tp = price <= trade["take_profit"]

        pnl = calc_trade_pnl(price, trade)
        age_seconds = int(time.time()) - int(trade["opened_at"])
        quality_drop = age_seconds >= MIN_HOLD_SECONDS and market_state[trade["symbol"]]["score"] < 0.18
        timed_exit = age_seconds > TIMED_EXIT_SECONDS and abs(pnl) < TIMED_EXIT_MAX_ABS_PNL

        if hit_stop or hit_tp or quality_drop or timed_exit:
            trade["status"] = "closed"
            trade["exit"] = round_price(price)
            trade["closed_at"] = int(time.time())
            trade["duration_seconds"] = age_seconds
            trade["duration_text"] = format_duration(age_seconds)
            trade["pnl_usd"] = round(pnl, 4)

            if hit_tp:
                trade["result"] = "win"
                trade["close_reason"] = "take_profit"
            elif hit_stop:
                if trade.get("trailing_active"):
                    trade["close_reason"] = "trailing_stop"
                elif trade.get("moved_to_break_even") and abs(price - trade["entry"]) / trade["entry"] < 0.002:
                    trade["close_reason"] = "break_even_stop"
                else:
                    trade["close_reason"] = "stop_loss"
                trade["result"] = "win" if pnl > 0 else "loss"
            elif quality_drop:
                trade["result"] = "win" if pnl > 0 else "loss"
                trade["close_reason"] = "quality_drop"
            else:
                trade["result"] = "win" if pnl > 0 else "loss"
                trade["close_reason"] = "timed_exit"

            bot_state["equity_usd"] = round(bot_state["equity_usd"] + trade["pnl_usd"], 4)
            set_symbol_cooldown(trade["symbol"])
            closed.append(enrich_trade_runtime(trade))

    return closed


def reset_paper_account() -> None:
    global last_market_fetch_ts
    bot_state["running"] = False
    bot_state["auto_enabled"] = False
    bot_state["equity_usd"] = INITIAL_EQUITY
    bot_state["starting_equity_usd"] = INITIAL_EQUITY
    bot_state["tick_count"] = 0
    bot_state["last_error"] = ""
    bot_state["last_auto_tick_ts"] = 0.0
    signals.clear()
    trades.clear()
    last_market_fetch_ts = 0.0
    for s in SYMBOLS:
        market_state[s] = {
            "price": 0.0,
            "change_24h": 0.0,
            "volume": 0.0,
            "score": 0.0,
            "trend_strength": 0.0,
            "quality": "low",
        }
        previous_market_state[s] = {
            "price": 0.0,
            "change_24h": 0.0,
            "volume": 0.0,
            "score": 0.0,
            "trend_strength": 0.0,
            "quality": "low",
        }
        symbol_cooldowns[s] = 0


async def run_tick_cycle():
    if not bot_state["running"]:
        return {"ok": False, "message": "Bot not running"}

    bot_state["tick_count"] += 1

    ok = await fetch_real_market_data()
    if not ok:
        return {"ok": False, "message": bot_state["last_error"] or "Market data fetch failed"}

    closed_trades = manage_open_trades()
    regime = get_market_regime()

    ranked = []
    for symbol in SYMBOLS:
        data = market_state[symbol]
        prev = previous_market_state.get(symbol, {})
        if data["price"] <= MIN_VALID_PRICE:
            continue

        side = "flat"

        strong_up = data["score"] >= 0.58 and data["change_24h"] >= 0.15
        strong_down = data["score"] >= 0.58 and data["change_24h"] <= -0.15
        medium_momentum = data["score"] >= 0.50 and data["trend_strength"] >= 0.60

        if strong_up:
            side = "long"
        elif strong_down:
            side = "short"
        elif medium_momentum:
            side = "long" if data["change_24h"] >= 0 else "short"

        if side != "flat" and not is_continuation_signal(symbol, data, prev, side):
            side = "flat"

        if regime["regime"] == "bullish":
            if side == "short" and data["score"] < 0.70:
                side = "flat"
            if side == "long" and not (
                data["score"] >= 0.52 and data["change_24h"] >= 0.10
            ):
                side = "flat"

        elif regime["regime"] == "bearish":
            if side == "long" and data["score"] < 0.70:
                side = "flat"
            if side == "short" and not (
                data["score"] >= 0.52 and data["change_24h"] <= -0.10
            ):
                side = "flat"

        else:
            if side == "long" and not (
                data["score"] >= 0.60 and data["trend_strength"] >= 0.90 and data["change_24h"] >= 0.25
            ):
                side = "flat"
            if side == "short" and not (
                data["score"] >= 0.60 and data["trend_strength"] >= 0.90 and data["change_24h"] <= -0.25
            ):
                side = "flat"

        recent_symbol_trades = recent_trade_count_for_symbol(symbol, 3600)
        diversification_penalty = min(recent_symbol_trades * 0.03, 0.12)
        adjusted_score = max(data["score"] - diversification_penalty, 0.0)

        ranked.append(
            {
                "symbol": symbol,
                "price": data["price"],
                "change_24h": data["change_24h"],
                "volume": data["volume"],
                "score": adjusted_score,
                "base_score": data["score"],
                "trend_strength": data["trend_strength"],
                "quality": data["quality"],
                "side": side,
                "cooldown": is_symbol_on_cooldown(symbol),
                "prev_score": float(prev.get("score", 0.0)),
                "prev_change_24h": float(prev.get("change_24h", 0.0)),
                "recent_symbol_trades": recent_symbol_trades,
            }
        )

    ranked.sort(key=lambda x: (x["score"], x["trend_strength"], x["volume"]), reverse=True)

    new_signals = []
    opened_trade = None

    if regime["allow_new_trades"] and recent_opened_trade_count() < MAX_NEW_TRADES_PER_10_MIN:
        for candidate in ranked:
            if candidate["side"] == "flat":
                continue
            if candidate["cooldown"]:
                continue
            if get_open_positions_count() >= bot_state["max_open_positions"]:
                break
            if has_open_trade_for_symbol(candidate["symbol"]):
                continue
            if recent_signal_count_for_symbol(candidate["symbol"]) >= MAX_RECENT_SAME_SYMBOL_SIGNALS:
                continue
            if candidate["price"] <= MIN_VALID_PRICE:
                continue

            signal = {
                "symbol": candidate["symbol"],
                "side": candidate["side"],
                "score": candidate["score"],
                "base_score": candidate["base_score"],
                "price": candidate["price"],
                "change_24h": candidate["change_24h"],
                "volume": candidate["volume"],
                "trend_strength": candidate["trend_strength"],
                "quality": candidate["quality"],
                "reason": (
                    f"regime={regime['regime']} + continuation + trend + momentum + volume "
                    f"+ diversification(recent_symbol_trades={candidate['recent_symbol_trades']}) "
                    f"(base_score={candidate['base_score']:.3f}, adj_score={candidate['score']:.3f})"
                ),
                "created_at": int(time.time()),
            }
            signals.insert(0, signal)
            new_signals.append(signal)

            if candidate["score"] >= MIN_SCORE_TO_OPEN:
                opened_trade = create_trade(candidate | {"reason": signal["reason"]})
                trades.insert(0, opened_trade)
                opened_trade = enrich_trade_runtime(opened_trade)
                break

    return {
        "ok": True,
        "tick_count": bot_state["tick_count"],
        "ranked": ranked,
        "new_signals": new_signals,
        "opened_trade": opened_trade,
        "closed_trades": closed_trades,
        "equity_usd": bot_state["equity_usd"],
        "stats": get_stats(),
        "market_regime": regime,
    }


@app.get("/")
def root():
    return {"message": "Backend online"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


@app.get("/api/v1/config")
def get_config():
    return {
        "mode": bot_state["mode"],
        "equity_usd": bot_state["equity_usd"],
        "max_open_positions": bot_state["max_open_positions"],
        "risk_per_trade_pct": bot_state["risk_per_trade_pct"],
        "symbols": bot_state["symbols"],
        "auto_enabled": bot_state["auto_enabled"],
        "auto_interval_seconds": bot_state["auto_interval_seconds"],
        "valid_kraken_pairs": KRAKEN_PAIRS,
        "simulated_leverage": SIMULATED_LEVERAGE,
    }


@app.get("/api/v1/state")
def get_state():
    return {
        "running": bot_state["running"],
        "auto_enabled": bot_state["auto_enabled"],
        "auto_interval_seconds": bot_state["auto_interval_seconds"],
        "last_auto_tick_ts": bot_state["last_auto_tick_ts"],
        "mode": bot_state["mode"],
        "equity_usd": bot_state["equity_usd"],
        "tick_count": bot_state["tick_count"],
        "open_positions": get_open_positions_count(),
        "last_error": bot_state["last_error"],
        "market": market_state,
        "cooldowns": symbol_cooldowns,
        "valid_kraken_pairs": KRAKEN_PAIRS,
        "market_regime": get_market_regime(),
        "simulated_leverage": SIMULATED_LEVERAGE,
    }


@app.get("/api/v1/signals")
def get_signals():
    return {"items": signals[:40]}


@app.get("/api/v1/trades")
def get_trades():
    return {"items": [enrich_trade_runtime(t) for t in trades[:100]]}


@app.get("/api/v1/open-trades")
def api_open_trades():
    return {"items": get_open_trades()[:30]}


@app.get("/api/v1/closed-trades")
def api_closed_trades():
    return {"items": get_closed_trades()[:30]}


@app.get("/api/v1/stats")
def api_stats():
    return get_stats()


@app.post("/api/v1/market/refresh")
async def api_market_refresh():
    ok = await refresh_valid_kraken_pairs()
    if not ok:
        return {"ok": False, "message": bot_state["last_error"]}

    ok = await fetch_real_market_data(force=True)
    if not ok:
        return {"ok": False, "message": bot_state["last_error"]}

    return {
        "ok": True,
        "market": market_state,
        "valid_kraken_pairs": KRAKEN_PAIRS,
        "market_regime": get_market_regime(),
    }


@app.post("/api/v1/bot/reset")
def api_bot_reset():
    reset_paper_account()
    return {"ok": True, "message": "Paper account reset done"}


@app.post("/api/v1/bot/start")
def start_bot():
    bot_state["running"] = True
    bot_state["last_error"] = ""
    return {"ok": True, "running": True}


@app.post("/api/v1/bot/stop")
def stop_bot():
    bot_state["running"] = False
    bot_state["auto_enabled"] = False
    return {"ok": True, "running": False}


@app.post("/api/v1/bot/auto-start")
def auto_start():
    bot_state["running"] = True
    bot_state["auto_enabled"] = True
    bot_state["last_error"] = ""
    return {"ok": True, "auto_enabled": True}


@app.post("/api/v1/bot/auto-stop")
def auto_stop():
    bot_state["auto_enabled"] = False
    return {"ok": True, "auto_enabled": False}


@app.post("/api/v1/bot/set-interval")
def set_interval(payload: Dict):
    seconds = int(payload.get("seconds", 30))
    seconds = max(10, min(seconds, 300))
    bot_state["auto_interval_seconds"] = seconds
    return {"ok": True, "auto_interval_seconds": seconds}


@app.post("/api/v1/bot/tick")
async def tick_bot():
    try:
        return await run_tick_cycle()
    except Exception as e:
        bot_state["last_error"] = f"tick_bot error: {str(e)}"
        print(bot_state["last_error"])
        return {"ok": False, "message": bot_state["last_error"]}


@app.post("/api/v1/bot/auto-pulse")
async def auto_pulse():
    try:
        if not bot_state["running"] or not bot_state["auto_enabled"]:
            return {"ok": True, "executed": False, "message": "Auto mode inactive"}

        now = time.time()
        wait_s = bot_state["auto_interval_seconds"]

        if bot_state["last_auto_tick_ts"] and (now - bot_state["last_auto_tick_ts"]) < wait_s:
            return {"ok": True, "executed": False, "message": "Waiting next interval"}

        result = await run_tick_cycle()
        if result.get("ok"):
            bot_state["last_auto_tick_ts"] = now
            result["executed"] = True
        else:
            result["executed"] = False

        return result

    except Exception as e:
        bot_state["last_error"] = f"auto_pulse error: {str(e)}"
        print(bot_state["last_error"])
        return {"ok": False, "message": bot_state["last_error"]}
