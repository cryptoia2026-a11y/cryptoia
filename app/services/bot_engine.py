from __future__ import annotations
from datetime import datetime
from app.core.config import settings
from app.models.schemas import BotState, TickResult
from app.services.market_data import MarketDataService
from app.services.paper_broker import PaperBroker
from app.services.risk_engine import RiskEngine
from app.strategies.signal_engine import SignalEngine

class BotEngine:
    def __init__(self) -> None:
        self.running = False
        self.market_data = MarketDataService()
        self.signal_engine = SignalEngine()
        self.paper_broker = PaperBroker()
        self.risk_engine = RiskEngine(
            equity_usd=settings.account_equity_usd,
            risk_per_trade_pct=settings.risk_per_trade_pct,
            max_daily_loss_pct=settings.max_daily_loss_pct,
        )
        self.last_signals = []
        self.last_tick_at = None

    def start(self) -> BotState:
        self.running = True
        return self.get_state()

    def stop(self) -> BotState:
        self.running = False
        return self.get_state()

    def get_state(self) -> BotState:
        daily_pnl = self.paper_broker.total_closed_pnl()
        return BotState(
            running=self.running,
            mode=settings.bot_mode,
            equity_usd=round(settings.account_equity_usd + daily_pnl, 2),
            daily_pnl_usd=daily_pnl,
            open_positions=self.paper_broker.open_positions_count(),
            total_trades=len(self.paper_broker.trades),
            last_tick_at=self.last_tick_at,
            allowed_live=settings.mexc_enable_live,
        )

    def tick(self) -> TickResult:
        snapshot = self.market_data.get_snapshot(settings.symbols_list)
        self.paper_broker.update_open_positions({k: v["price"] for k, v in snapshot.items()})
        signals = self.signal_engine.generate(snapshot)
        self.last_signals = signals
        executed = []

        for signal in signals:
            if signal.side == "flat":
                continue
            ok, _reason = self.risk_engine.can_trade(
                daily_pnl_usd=self.paper_broker.total_closed_pnl(),
                open_positions=self.paper_broker.open_positions_count(),
                max_open_positions=settings.max_open_positions,
            )
            if not ok:
                break
            stop_loss = signal.price * (0.994 if signal.side == "long" else 1.006)
            size_usd = self.risk_engine.position_size_usd(signal.price, stop_loss)
            trade = self.paper_broker.execute_signal(signal, size_usd)
            if trade:
                executed.append(trade)
                if self.paper_broker.open_positions_count() >= settings.max_open_positions:
                    break

        self.last_tick_at = datetime.utcnow()
        return TickResult(generated_signals=signals, executed_trades=executed, state=self.get_state())

bot_engine = BotEngine()
