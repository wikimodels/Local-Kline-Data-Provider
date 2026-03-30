/**
 * =================================================================================
 * Angular Models (based on backend types.ts)
 * =================================================================================
 */

// --- Core Types ---

/**
 * Valid timeframes.
 */
export type TF = '1h' | '4h' | '8h' | '12h' | 'D';

/**
 * Valid exchanges.
 */
export type Exchange = 'binance' | 'bybit';

// --- Market Data Types ---

/**
 * Represents a single (enriched) candle.
 */
export interface Candle {
  openTime: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  volumeDelta?: number | null;
  openInterest?: number | null;
  fundingRate?: number | null;
  closeTime?: number;

  // EMA
  ema50?: number | null;
  ema100?: number | null;
  ema150?: number | null;

  adx?: number | null;
  diPlus?: number | null;
  diMinus?: number | null;

  wAvwap?: number | null;
  wAvwapUpperBand?: number | null;
  wAvwapLowerBand?: number | null;

  mAvwap?: number | null;
  mAvwapUpperBand?: number | null;
  mAvwapLowerBand?: number | null;

  bbBasis?: number | null;
  bbUpper?: number | null;
  bbLower?: number | null;
  bbWidth?: number | null;

  chv?: number | null;
  cmf?: number | null;

  isDoji?: boolean | null;
  isBullishEngulfing?: boolean | null;
  isBearishEngulfing?: boolean | null;
  isHammer?: boolean | null;
  isPinbar?: boolean | null;

  macd?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;

  kama?: number | null;

  obv?: number | null;
  obvEma20?: number | null;

  rsi?: number | null;
  vzo?: number | null;

  rvwap?: number | null;
  rvwapUpperBand1?: number | null;
  rvwapUpperBand2?: number | null;
  rvwapLowerBand1?: number | null;
  rvwapLowerBand2?: number | null;
  rvwapWidth1?: number | null;
  rvwapWidth2?: number | null;

  lowest50?: number | null;
  lowest100?: number | null;
  highest50?: number | null;
  highest100?: number | null;

  closePriceZScore?: number | null;
  volumeZScore?: number | null;
  volumeDeltaZScore?: number | null;
  openInterestZScore?: number | null;
  fundingRateZScore?: number | null;

  slopeEma50?: number | null;
  slopeEma100?: number | null;
  slopeEma150?: number | null;
  slopeRvwap?: number | null;
  slopeMAvwap?: number | null;
  slopeWAvwap?: number | null;
  slopeZClose?: number | null;
  slopeZVolume?: number | null;
  slopeZVolumeDelta?: number | null;
  slopeZOi?: number | null;
  slopeZFunding?: number | null;

  isAboveRvwap?: boolean | null;
  isBelowRvwap?: boolean | null;
  isCrossedUpRvwap?: boolean | null;
  isCrossedDownRvwap?: boolean | null;
  isBetweenRvwapBands?: boolean | null;

  // RVWAP Band Crossovers
  isCrossedUpRvwapUpperBand1?: boolean | null;
  isCrossedDownRvwapUpperBand1?: boolean | null;
  isCrossedUpRvwapUpperBand2?: boolean | null;
  isCrossedDownRvwapUpperBand2?: boolean | null;
  isCrossedUpRvwapLowerBand1?: boolean | null;
  isCrossedDownRvwapLowerBand1?: boolean | null;
  isCrossedUpRvwapLowerBand2?: boolean | null;
  isCrossedDownRvwapLowerBand2?: boolean | null;

  isAboveKama?: boolean | null;
  isBelowKama?: boolean | null;
  isCrossedUpKama?: boolean | null;
  isCrossedDownKama?: boolean | null;

  isAboveEma50?: boolean | null;
  isBelowEma50?: boolean | null;
  isCrossedUpEma50?: boolean | null;
  isCrossedDownEma50?: boolean | null;

  isAboveEma100?: boolean | null;
  isBelowEma100?: boolean | null;
  isCrossedUpEma100?: boolean | null;
  isCrossedDownEma100?: boolean | null;

  isAboveEma150?: boolean | null;
  isBelowEma150?: boolean | null;
  isCrossedUpEma150?: boolean | null;
  isCrossedDownEma150?: boolean | null;

  isBullishFan?: boolean | null;
  isBearishFan?: boolean | null;
  isMessFan?: boolean | null;

  // === Breakout signals ===
  isCrossedUpHighest50?: boolean | null;
  isCrossedDownLowest50?: boolean | null;
  isCrossedUpHighest100?: boolean | null;
  isCrossedDownLowest100?: boolean | null;

  // === W-AVWAP states ===
  isAboveWAvwap?: boolean | null;
  isBelowWAvwap?: boolean | null;
  isCrossedUpWAvwap?: boolean | null;
  isCrossedDownWAvwap?: boolean | null;

  // === M-AVWAP states ===
  isAboveMAvwap?: boolean | null;
  isBelowMAvwap?: boolean | null;
  isCrossedUpMAvwap?: boolean | null;
  isCrossedDownMAvwap?: boolean | null;

  // === EMA Fan Punches ===
  isBullishPunch?: boolean | null;
  isBearishPunch?: boolean | null;

  // === RVWAP-RSI Divergence ===
  isBullishRvwapRsiDivergence?: boolean | null;
  isBearishRvwapRsiDivergence?: boolean | null;

  // === RVWAP-VZO Divergence ===
  isBullishRvwapVzoDivergence?: boolean | null;
  isBearishRvwapVzoDivergence?: boolean | null;

  // === RVWAP-CMF Divergence ===
  isBullishRvwapCmfDivergence?: boolean | null;
  isBearishRvwapCmfDivergence?: boolean | null;

  // === Order Flow Regime ===
  isLongAccumulation?: boolean | null;
  isShortAccumulation?: boolean | null;
  isLongLiquidation?: boolean | null;
  isShortCovering?: boolean | null;

  // === RVWAP Momentum Reversal ===
  isTopReversalRisk?: boolean | null;
  isBottomReversalChance?: boolean | null;

  // === CMF Slope Change ===
  isCmfSlopeUp?: boolean | null;
  isCmfSlopeDown?: boolean | null;

  // === Statistical Metrics ===
  hurst?: number | null;           // Hurst Exponent (0-1)
  hurstConfidence?: number | null; // R-squared confidence
  kurtosis?: number | null;        // Kurtosis (excess)
  skewness?: number | null;        // Skewness
  efficiencyRatio?: number | null; // Kaufman's ER (0-1)
  entropy20?: number | null;       // Market Entropy (20 candles)

  // === Market Regime Signals ===
  isTrendingRegimeStart?: boolean | null;
  isMeanReversionRegimeStart?: boolean | null;

  // === Volatility Exhaustion ===
  isVolatilityExhaustion?: boolean | null;

  // === Skew Reversal ===
  isBullishSkewReversal?: boolean | null;
  isBearishSkewReversal?: boolean | null;
}
/**
 * Holds all candle data for a single coin.
 */
export interface CoinMarketData {
  symbol: string;
  exchanges: string[];
  category: number;
  btc_corr_1d_w30?: number;
  candles: Candle[];
}

/**
 * The main data snapshot for a timeframe.
 * This is the object returned inside the API's 'data' property.
 */
export interface MarketData {
  timeframe: TF;
  openTime: number;
  updatedAt: number;
  coinsNumber: number;
  data: CoinMarketData[];
}

// --- API Response Type ---

/**
 * The full response wrapper for the /api/cache/:tf endpoint.
 */
export interface KlineApiResponse {
  success: boolean;
  data: MarketData; // <-- Now strongly typed
  cached?: boolean;
  error?: string;
}

/**
 * The response wrapper for the /api/cache/all endpoint.
 */
export interface KlineApiAllResponse {
  success: boolean;
  data: MarketData[]; // <-- An array of MarketData
  error?: string;
}

// projects/data-core/src/lib/models/series.model.ts

export interface PriceSeries {
  // Стандартные поля
  openTime: number[];
  openPrice: number[];
  highPrice: number[];
  lowPrice: number[];
  closePrice: number[];
  volume: number[];
  // ✅ ДОБАВЛЕНО: Таймфрейм графика (например, '4h', '1d', '15m')
  timeframe: string;
  // --- АГРЕГИРОВАННЫЕ ПОЛЯ (ОИ, ФР, ДЕЛЬТА) ---
  openInterest?: number[]; // Open Interest (OI)
  fundingRate?: number[]; // Funding Rate (FR)
  volumeDelta?: number[]; // Volume Delta
}
