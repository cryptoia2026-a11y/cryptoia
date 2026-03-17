from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

class Signal(BaseModel):
    symbol: str
    timeframe: str
    side: Literal["long", "short", "flat"]
    score: float
    confidence: float
    reason: str
    price: float
    created_at: datetime

class Trade(BaseModel):
    id: str
    symbol: str
    side: Literal["long", "short"]
    entry_price: float
    stop_loss: float
    take_profit: float
    size_usd: float
    status: Literal["open", "closed"]
    pnl_usd: float = 0.0
    opened_at: datetime
    closed_at: Optional[datetime] = None
    exit_reason: Optional[str] = None

class BotState(BaseModel):
    running: bool
    mode: str
    equity_usd: float
    daily_pnl_usd: float
    open_positions: int
    total_trades: int
    last_tick_at: Optional[datetime] = None
    allowed_live: bool = False

class TickResult(BaseModel):
    generated_signals: List[Signal]
    executed_trades: List[Trade]
    state: BotState
