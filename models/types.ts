/**
 * =================================================================================
 * Global Types and Interfaces
 * =================================================================================
 */

// Timeframes
export type TF = "1h" | "4h" | "8h" | "12h" | "D";
export const TF_MAP: Record<string, TF> = {
  "1h": "1h",
  "4h": "4h",
  "8h": "8h",
  "12h": "12h",
  D: "D",
};

// Exchanges
export type Exchange = "binance" | "bybit";

// Colors for logger
export enum DColors {
  red = "\x1b[31m",
  green = "\x1b[32m",
  yellow = "\x1b[33m",
  cyan = "\x1b[36m",
  white = "\x1b[37m",
  gray = "\x1b[90m",
  reset = "\x1b[0m",
}

/**
 * =================================================================================
 * Fetcher Types
 * =================================================================================
 */

// Fetch options for batch processing
export type FetchOptions = {
  batchSize?: number;
  delayMs?: number;
};

// Coin from Coin Sifter API
export type Coin = {
  symbol: string;
  exchanges: string[];
  category: number;
};

// Coin groups by exchange
export type CoinGroups = {
  binanceCoins: Coin[];
  bybitCoins: Coin[];
};

// Failed coin result
export type FailedCoinResult = {
  symbol: string;
  error: string;
};

// Fetcher result
export type FetcherResult = {
  successful: CoinMarketData[];
  failed: FailedCoinResult[];
};

/**
 * =================================================================================
 * Market Data Types
 * =================================================================================
 */

/**
 * Candle (enriched with OI, FR, and indicators)
 */
export interface Candle {
  openTime: number; // Required (timestamp)
  openPrice?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;
  closePrice?: number | null;
  volume?: number | null;
  volumeDelta?: number | null;
  openInterest?: number | null;
  fundingRate?: number | null;
  closeTime?: number; // Temporary for Binance Klines

  // Indicators will be added dynamically by pipeline
  [key: string]: unknown;
}

/**
 * Coin market data (enriched)
 */
export interface CoinMarketData {
  symbol: string;
  exchanges: string[];
  category: number;
  candles: Candle[];
  btc_corr_1d_w30?: number; // BTC correlation (added by pipeline)
}

/**
 * Market data snapshot
 * Main object stored in cache
 */
export interface MarketData {
  timeframe: TF;
  openTime: number; // Opening time of the last (current) candle
  updatedAt: number; // Last update timestamp
  coinsNumber: number; // Number of coins in 'data'
  data: CoinMarketData[]; // Array of coin data
}

/**
 * =================================================================================
 * Price Series (for calculations)
 * =================================================================================
 */

export interface PriceSeries {
  openTime: number[];
  openPrice: number[];
  highPrice: number[];
  lowPrice: number[];
  closePrice: number[];
  volume: number[];
  timeframe: string;
  openInterest?: number[];
  fundingRate?: number[];
  volumeDelta?: number[];
}

/**
 * =================================================================================
 * Job Types
 * =================================================================================
 */

// Job result
export interface JobResult {
  success: boolean;
  timeframe: TF | "N/A";
  totalCoins: number;
  successfulCoins: number;
  failedCoins: number;
  errors: string[];
  executionTime: number; // in milliseconds
}
