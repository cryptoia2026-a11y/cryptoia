from __future__ import annotations
from datetime import datetime
from uuid import uuid4
from typing import List
from app.models.schemas import Trade, Signal

class PaperBroker:
    def __init__(self) -> None:
        self.trades: List[Trade] = []

    def execute_signal(self, signal: Signal, size_usd: float) -> Trade | None:
        if signal.side not in ("long", "short") or size_usd <= 0:
            return None
        stop_distance = signal.price * 0.006
        tp_distance = signal.price * 0.012
        trade = Trade(
            id=str(uuid4())[:8],
            symbol=signal.symbol,
            side=signal.side,
            entry_price=signal.price,
            stop_loss=round(signal.price - stop_distance if signal.side == "long" else signal.price + stop_distance, 6),
            take_profit=round(signal.price + tp_distance if signal.side == "long" else signal.price - tp_distance, 6),
            size_usd=size_usd,
            status="open",
            opened_at=datetime.utcnow(),
        )
        self.trades.append(trade)
        return trade

    def update_open_positions(self, market_prices: dict) -> None:
        for trade in self.trades:
            if trade.status != "open":
                continue
            price = market_prices.get(trade.symbol, trade.entry_price)
            if trade.side == "long":
                if price <= trade.stop_loss:
                    trade.status = "closed"
                    trade.pnl_usd = round(-(trade.size_usd * 0.006), 2)
                    trade.exit_reason = "stop_loss"
                    trade.closed_at = datetime.utcnow()
                elif price >= trade.take_profit:
                    trade.status = "closed"
                    trade.pnl_usd = round(trade.size_usd * 0.012, 2)
                    trade.exit_reason = "take_profit"
                    trade.closed_at = datetime.utcnow()
            else:
                if price >= trade.stop_loss:
                    trade.status = "closed"
                    trade.pnl_usd = round(-(trade.size_usd * 0.006), 2)
                    trade.exit_reason = "stop_loss"
                    trade.closed_at = datetime.utcnow()
                elif price <= trade.take_profit:
                    trade.status = "closed"
                    trade.pnl_usd = round(trade.size_usd * 0.012, 2)
                    trade.exit_reason = "take_profit"
                    trade.closed_at = datetime.utcnow()

    def open_positions_count(self) -> int:
        return sum(1 for t in self.trades if t.status == "open")

    def total_closed_pnl(self) -> float:
        return round(sum(t.pnl_usd for t in self.trades if t.status == "closed"), 2)
