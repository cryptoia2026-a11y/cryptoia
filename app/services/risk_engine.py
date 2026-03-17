from __future__ import annotations

class RiskEngine:
    def __init__(self, equity_usd: float, risk_per_trade_pct: float, max_daily_loss_pct: float) -> None:
        self.equity_usd = equity_usd
        self.risk_per_trade_pct = risk_per_trade_pct
        self.max_daily_loss_pct = max_daily_loss_pct

    def can_trade(self, daily_pnl_usd: float, open_positions: int, max_open_positions: int) -> tuple[bool, str]:
        max_daily_loss_usd = self.equity_usd * (self.max_daily_loss_pct / 100)
        if daily_pnl_usd <= -max_daily_loss_usd:
            return False, "Daily loss limit hit"
        if open_positions >= max_open_positions:
            return False, "Max open positions reached"
        return True, "OK"

    def position_size_usd(self, entry_price: float, stop_loss: float) -> float:
        risk_usd = self.equity_usd * (self.risk_per_trade_pct / 100)
        stop_distance = abs(entry_price - stop_loss)
        if stop_distance <= 0:
            return 0.0
        units = risk_usd / stop_distance
        return round(units * entry_price, 2)
