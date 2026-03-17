from __future__ import annotations
from typing import Dict, List
from datetime import datetime
from app.models.schemas import Signal

class SignalEngine:
    def generate(self, market_snapshot: Dict[str, dict]) -> List[Signal]:
        signals: List[Signal] = []
        for symbol, data in market_snapshot.items():
            trend = data["trend_score"]
            volume = data["volume_score"]
            volatility = data["volatility_score"]
            liquidity = data["liquidity_score"]
            spread_ok = data["spread_bps"] <= 8

            score = (trend * 0.35) + (volume * 0.25) + (volatility * 0.20) + (liquidity * 0.20)
            confidence = min(0.99, max(0.0, score))

            side = "flat"
            reason = "No clean setup"
            if spread_ok and trend > 0.65 and volume > 0.55 and liquidity > 0.7:
                side = "long"
                reason = "Trend continuation setup"
            elif spread_ok and trend < 0.25 and volatility > 0.55 and liquidity > 0.7:
                side = "short"
                reason = "Breakdown or weakness setup"

            signals.append(
                Signal(
                    symbol=symbol,
                    timeframe="5m",
                    side=side,
                    score=round(score * 100, 2),
                    confidence=round(confidence, 3),
                    reason=reason,
                    price=float(data["price"]),
                    created_at=datetime.utcnow(),
                )
            )
        signals.sort(key=lambda s: (s.side != "flat", s.score), reverse=True)
        return signals
