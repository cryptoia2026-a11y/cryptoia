from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_name: str = Field(default="MEXC AI Trading Bot")
    app_env: str = Field(default="development")
    debug: bool = Field(default=True)
    bot_mode: str = Field(default="paper")
    account_equity_usd: float = Field(default=1000.0)
    risk_per_trade_pct: float = Field(default=0.5)
    max_daily_loss_pct: float = Field(default=3.0)
    max_open_positions: int = Field(default=3)
    symbols: str = Field(default="BTC/USDT,ETH/USDT,SOL/USDT")
    timeframes: str = Field(default="1m,5m,15m,1h")
    tick_interval_seconds: int = Field(default=15)
    mexc_api_key: str = Field(default="")
    mexc_api_secret: str = Field(default="")
    mexc_enable_live: bool = Field(default=False)

    @property
    def symbols_list(self) -> List[str]:
        return [s.strip() for s in self.symbols.split(",") if s.strip()]

settings = Settings()
