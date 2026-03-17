from __future__ import annotations
import random
from typing import Dict, List
from datetime import datetime

class MarketDataService:
    def __init__(self) -> None:
        self._last_prices = {
            "BTC/USDT": 82000.0,
            "ETH/USDT": 4200.0,
            "SOL/USDT": 210.0,
            "XRP/USDT": 1.15,
        }

    def get_snapshot(self, symbols: List[str]) -> Dict[str, dict]:
        snapshot = {}
        for symbol in symbols:
            base = self._last_prices.get(symbol, 100.0)
            drift = random.uniform(-0.008, 0.008)
            price = max(0.0001, base * (1 + drift))
            self._last_prices[symbol] = price
            snapshot[symbol] = {
                "symbol": symbol,
                "price": round(price, 6),
                "change_1m_pct": round(random.uniform(-1.0, 1.0), 3),
                "change_5m_pct": round(random.uniform(-2.5, 2.5), 3),
                "trend_score": round(random.uniform(0, 1), 3),
                "volume_score": round(random.uniform(0, 1), 3),
                "volatility_score": round(random.uniform(0, 1), 3),
                "liquidity_score": round(random.uniform(0.6, 1.0), 3),
                "spread_bps": round(random.uniform(1, 12), 2),
                "timestamp": datetime.utcnow().isoformat(),
            }
        return snapshot
