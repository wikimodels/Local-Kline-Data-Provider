// services/metrics/vzo-median.metric.ts
// Calculates the aggregated VZO Median across all coins for the latest candle.
// Self-contained: computes VZO internally if it's not already in candle data.
// Ported from Эталон/services/vzo-median.service.ts (Angular) → Deno.

import { MarketData } from "../../models/types.ts";
import { calculateVZO } from "../../functions/calculations/vzo.ts";
import { IMetric, MetricResult } from "./metric.interface.ts";

export class VzoMedianMetric implements IMetric {
    /** Unique machine-readable key (used in thresholds.json) */
    public readonly key = "vzo_median";

    /** Human-readable display label (used in Telegram messages) */
    public readonly label = "VZO Median";

    /** Minimum candle count for a meaningful VZO */
    private readonly MIN_CANDLES = 14;

    /**
     * Computes the VZO median across all coins for the latest candle.
     * If the pipeline already ran (vzo field present), uses that value.
     * Otherwise computes VZO from raw price/volume data.
     * Returns null if there is insufficient data.
     */
    public compute(data: MarketData): MetricResult | null {
        const values: number[] = [];

        for (const coin of data.data) {
            if (!coin.candles || coin.candles.length < this.MIN_CANDLES) continue;

            const lastCompletedCandle = coin.candles[coin.candles.length - 2] as any;

            // --- Fast path: pipeline already computed VZO ---
            const cached = lastCompletedCandle?.vzo;
            if (
                cached !== undefined &&
                cached !== null &&
                !isNaN(cached) &&
                Math.abs(cached) >= 0.0001
            ) {
                values.push(cached);
                continue;
            }

            // --- Slow path: compute VZO on the fly ---
            const closePrices = coin.candles
                .map((c) => c.closePrice ?? NaN) as number[];
            const volumes = coin.candles
                .map((c) => c.volume ?? 0) as number[];

            if (closePrices.some(isNaN)) continue;

            try {
                const priceSeries = {
                    openTime: coin.candles.map((c) => c.openTime),
                    openPrice: coin.candles.map((c) => c.openPrice ?? 0),
                    highPrice: coin.candles.map((c) => c.highPrice ?? 0),
                    lowPrice: coin.candles.map((c) => c.lowPrice ?? 0),
                    closePrice: closePrices,
                    volume: volumes,
                    timeframe: data.timeframe,
                };

                const vzoResult = calculateVZO(priceSeries);
                const vzoArr = vzoResult["vzo"];
                const lastCompletedVzo = vzoArr[vzoArr.length - 2];

                if (
                    lastCompletedVzo !== undefined &&
                    lastCompletedVzo !== null &&
                    !isNaN(lastCompletedVzo) &&
                    Math.abs(lastCompletedVzo) >= 0.0001
                ) {
                    values.push(lastCompletedVzo);
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
        const clean = values.filter((v) => !isNaN(v));
        if (clean.length === 0) return 0;

        clean.sort((a, b) => a - b);
        const mid = Math.floor(clean.length / 2);
        const med =
            clean.length % 2 !== 0
                ? clean[mid]
                : (clean[mid - 1] + clean[mid]) / 2;
        return parseFloat(med.toFixed(2));
    }
}
