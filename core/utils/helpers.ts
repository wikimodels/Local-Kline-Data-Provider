import { Coin, CoinGroups, TF } from "../../models/types.ts";

/**
 * Timeframe durations in milliseconds
 */
export const TIMEFRAME_MS: Record<TF, number> = {
  "1h": 3600000,
  "4h": 14400000,
  "8h": 28800000,
  "12h": 43200000,
  D: 86400000,
};

/**
 * Split coins by exchange
 * LOGIC:
 * - If coin has BYBIT in exchanges[] -> goes to Bybit group ONLY
 * - If coin has ONLY BINANCE -> goes to Binance group
 * This eliminates duplicates!
 */
export function splitCoinsByExchange(coins: Coin[]): CoinGroups {
  const binanceCoins: Coin[] = [];
  const bybitCoins: Coin[] = [];

  for (const coin of coins) {
    // Case-insensitive check for exchange names
    const exchanges = coin.exchanges.map((e) => e.toUpperCase());

    // Priority: Bybit first
    if (exchanges.includes("BYBIT")) {
      bybitCoins.push(coin);
    } else if (exchanges.includes("BINANCE")) {
      // Only if NOT on Bybit
      binanceCoins.push(coin);
    }
  }

  return { binanceCoins, bybitCoins };
}

/**
 * Get current candle opening time for a given timeframe
 */
export function getCurrentCandleTime(intervalMs: number): number {
  const now = Date.now();
  return Math.floor(now / intervalMs) * intervalMs;
}

/**
 * Delay helper
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sleep alias for delay (backward compatibility)
 */
export const sleep = delay;

/**
 * Chunk array into batches
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
