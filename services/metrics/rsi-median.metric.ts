// services/metrics/rsi-median.metric.ts
// Calculates the aggregated RSI Median across all coins for the latest candle timestamp.
// Self-contained: computes RSI internally if it's not already in candle data.
// Ported from Эталон/services/rsi-median.service.ts (Angular) → Deno.

import { MarketData } from "../../models/types.ts";
import { calculateRSI } from "../../functions/calculations/rsi.ts";
import { IMetric, MetricResult } from "./metric.interface.ts";

export class RsiMedianMetric implements IMetric {
    /** Unique machine-readable key (used in thresholds.json) */
    public readonly key = "rsi_median";

    /** Human-readable display label (used in Telegram messages) */
    public readonly label = "RSI Median";

    /** RSI period — must match indicator-pipeline.ts */
    private readonly RSI_PERIOD = 10;

    /**
     * Computes the RSI median across all coins for the latest candle.
     * If the pipeline already ran (rsi field present), uses that value.
     * Otherwise computes RSI from raw close prices.
     * Returns null if there is insufficient data.
     */
    public compute(data: MarketData): MetricResult | null {
        const values: number[] = [];

        for (const coin of data.data) {
            if (!coin.candles || coin.candles.length < 2) continue;

            const lastCompletedCandle = coin.candles[coin.candles.length - 2] as any;

            // --- Fast path: pipeline already computed RSI ---
            if (lastCompletedCandle?.rsi !== undefined && lastCompletedCandle?.rsi !== null && !isNaN(lastCompletedCandle.rsi)) {
                values.push(lastCompletedCandle.rsi);
                continue;
            }

            // --- Slow path: compute RSI on the fly ---
            const closePrices = coin.candles
                .map((c) => c.closePrice)
                .filter((v) => v !== null && v !== undefined && !isNaN(v as number)) as number[];

            if (closePrices.length < this.RSI_PERIOD + 1) continue;

            try {
                const priceSeries = {
                    openTime: coin.candles.map((c) => c.openTime),
                    openPrice: coin.candles.map((c) => c.openPrice ?? 0),
                    highPrice: coin.candles.map((c) => c.highPrice ?? 0),
                    lowPrice: coin.candles.map((c) => c.lowPrice ?? 0),
                    closePrice: closePrices,
                    volume: coin.candles.map((c) => c.volume ?? 0),
                    timeframe: data.timeframe,
                };

                const rsiResult = calculateRSI(priceSeries, this.RSI_PERIOD);
                const rsiArr = rsiResult["rsi"];
                // We want the RSI for the last fully COMPLETED candle (which is at index length - 2)
                const lastCompletedRsi = rsiArr[rsiArr.length - 2];

                if (lastCompletedRsi !== undefined && lastCompletedRsi !== null && !isNaN(lastCompletedRsi)) {
                    values.push(lastCompletedRsi);
                }
            } catch (_) {
                // skip broken coins silently
            }
        }

        if (values.length === 0) return null;

        return {
            key: this.key,
            label: this.label,
            value: this.getMedian(values),
            coinsCount: values.length,
        };
    }

    private getMedian(values: number[]): number {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const med =
            sorted.length % 2 !== 0
                ? sorted[mid]
                : (sorted[mid - 1] + sorted[mid]) / 2;
        return parseFloat(med.toFixed(2));
    }
}
