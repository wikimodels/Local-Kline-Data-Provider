// services/metrics/metrics-registry.ts
import { IMetric } from "./metric.interface.ts";
import { RsiMedianMetric } from "./rsi-median.metric.ts";
import { VzoMedianMetric } from "./vzo-median.metric.ts";
import { BooleanCountMetric, MacdFadeMetric, AnomalyMetric } from "./generic-metrics.ts";

/**
 * Central registry of all available metrics.
 */
export const REGISTERED_METRICS: IMetric[] = [
    // Existing Median Metrics
    new RsiMedianMetric(),
    new VzoMedianMetric(),

    // --- EMA Crosses (Events) ---
    new BooleanCountMetric("ema50_breakup", "EMA 50 Breakup", "isCrossedUpEma50"),
    new BooleanCountMetric("ema100_breakup", "EMA 100 Breakup", "isCrossedUpEma100"),
    new BooleanCountMetric("ema150_breakup", "EMA 150 Breakup", "isCrossedUpEma150"),
    new BooleanCountMetric("ema50_breakdown", "EMA 50 Breakdown", "isCrossedDownEma50"),
    new BooleanCountMetric("ema100_breakdown", "EMA 100 Breakdown", "isCrossedDownEma100"),
    new BooleanCountMetric("ema150_breakdown", "EMA 150 Breakdown", "isCrossedDownEma150"),

    // --- EMA Fan Structure ---
    new BooleanCountMetric("ema_bullish_fan", "EMA Bullish Fan", "isBullishFan"),
    new BooleanCountMetric("ema_bearish_fan", "EMA Bearish Fan", "isBearishFan"),
    new BooleanCountMetric("ema_fan_reversals", "EMA Fan Reversals", "isBullishPunch"), // BullishPunch = reversal start

    // --- Market EMA Regime (States) ---
    new BooleanCountMetric("above_50", "Price Above EMA 50", "isAboveEma50"),
    new BooleanCountMetric("above_100", "Price Above EMA 100", "isAboveEma100"),
    new BooleanCountMetric("above_150", "Price Above EMA 150", "isAboveEma150"),
    new BooleanCountMetric("below_50", "Price Below EMA 50", "isBelowEma50"),
    new BooleanCountMetric("below_100", "Price Below EMA 100", "isBelowEma100"),
    new BooleanCountMetric("below_150", "Price Below EMA 150", "isBelowEma150"),

    // --- Market Extremum Breakouts ---
    new BooleanCountMetric("new_high50", "New 50-bar High", "isCrossedUpHighest50"),
    new BooleanCountMetric("new_high100", "New 100-bar High", "isCrossedUpHighest100"),
    new BooleanCountMetric("new_low50", "New 50-bar Low", "isCrossedDownLowest50"),
    new BooleanCountMetric("new_low100", "New 100-bar Low", "isCrossedDownLowest100"),

    // --- KAMA Crosses ---
    new BooleanCountMetric("kama_crossup", "KAMA Cross Up", "isCrossedUpKama"),
    new BooleanCountMetric("kama_crossdown", "KAMA Cross Down", "isCrossedDownKama"),

    // --- MACD Fading ---
    new MacdFadeMetric("macd_fading_bull", "MACD Fading Bull", "bull_fade"),
    new MacdFadeMetric("macd_fading_bear", "MACD Fading Bear", "bear_fade"),

    // --- Order Flow ---
    new BooleanCountMetric("long_acc", "Long Accumulation", "isLongAccumulation"),

    // --- Patterns ---
    new BooleanCountMetric("pinbars", "Pinbars Detected", "isPinbar"),
    new BooleanCountMetric("hammers", "Hammers Detected", "isHammer"),
    new BooleanCountMetric("bearish_engulfing", "Bearish Engulfing", "isBearishEngulfing"),
    new BooleanCountMetric("bullish_engulfing", "Bullish Engulfing", "isBullishEngulfing"),

    // --- RVWAP / Divergences ---
    new BooleanCountMetric("vzo_slope", "VZO Slope Divergence", "isBearishRvwapVzoDivergence"), // placeholder for slope info

    // --- RVWAP Structure ---
    new BooleanCountMetric("strong_bull", "Strong Bull Regime", "isAboveRvwapUpperBand1"), // based on bands
    new BooleanCountMetric("fomo", "FOMO (Band 2+)", "isAboveRvwapUpperBand2"),

    // --- Trend Rollover ---
    new BooleanCountMetric("bearish_exhaustion", "Bearish Exhaustion", "isTopReversalRisk"),
    new BooleanCountMetric("bullish_exhaustion", "Bullish Exhaustion", "isBottomReversalChance"),

    // --- Market Anomalies ---
    new AnomalyMetric("funding", "Funding Rate Anomaly", "fundingRateZScore"),
    new AnomalyMetric("oi", "OI Anomaly", "oiZScore"),
];

/**
 * Quick lookup map for metrics by key.
 */
export const METRICS_MAP = new Map<string, IMetric>(
    REGISTERED_METRICS.map((m) => [m.key, m] as [string, IMetric])
);
