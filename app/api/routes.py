from fastapi import APIRouter
from app.core.config import settings
from app.services.bot_engine import bot_engine

router = APIRouter(prefix="/api/v1", tags=["bot"])

@router.get("/config")
def get_config():
    return {
        "app_name": settings.app_name,
        "mode": settings.bot_mode,
        "symbols": settings.symbols_list,
        "risk_per_trade_pct": settings.risk_per_trade_pct,
        "max_daily_loss_pct": settings.max_daily_loss_pct,
        "max_open_positions": settings.max_open_positions,
        "live_enabled": settings.mexc_enable_live,
    }

@router.get("/state")
def get_state():
    return bot_engine.get_state()

@router.post("/bot/start")
def start_bot():
    return bot_engine.start()

@router.post("/bot/stop")
def stop_bot():
    return bot_engine.stop()

@router.post("/bot/tick")
def manual_tick():
    return bot_engine.tick()

@router.get("/trades")
def get_trades():
    return bot_engine.paper_broker.trades

@router.get("/signals")
def get_signals():
    return bot_engine.last_signals
