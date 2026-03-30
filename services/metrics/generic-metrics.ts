// services/metrics/generic-metrics.ts
import { MarketData, Candle } from "../../models/types.ts";
import { IMetric, MetricResult } from "./metric.interface.ts";

/**
 * Counts how many coins have a specific boolean flag set to true.
 * Result value is the percentage of coins (0-100).
 */
export class BooleanCountMetric implements IMetric {
    constructor(
        public readonly key: string,
        public readonly label: string,
        private readonly flagName: string
    ) { }

    public compute(data: MarketData): MetricResult | null {
        let count = 0;
        let total = 0;

        for (const coin of data.data) {
            // We need at least 2 candles to access the last *completed* candle securely.
            if (!coin.candles || coin.candles.length < 2) continue;

            // coin.candles.length - 1 is the currently forming (incomplete) candle.
            // coin.candles.length - 2 is the last FULLY COMPLETED candle.
            const lastCompleted = coin.candles[coin.candles.length - 2] as any;

            const val = lastCompleted[this.flagName];
            if (val === undefined || val === null) continue;

            total++;
            if (val === true) count++;
        }

        if (total === 0) return null;

        return {
            key: this.key,
            label: this.label,
            value: count,
            currentPercentage: parseFloat(((count / total) * 100).toFixed(1)),
            coinsCount: total,
        };
    }
}

/**
 * Specifically for MACD Fading logic (current histogram vs previous)
 */
export class MacdFadeMetric implements IMetric {
    constructor(
        public readonly key: string,
        public readonly label: string,
        private readonly type: 'bull_fade' | 'bear_fade'
    ) { }

    public compute(data: MarketData): MetricResult | null {
        let count = 0;
        let total = 0;

        for (const coin of data.data) {
            // We need at least 3 candles:
            // length - 1 = forming candle
            // length - 2 = last completed candle (curr)
            // length - 3 = previous completed candle (prev)
            if (!coin.candles || coin.candles.length < 3) continue;
            const curr = coin.candles[coin.candles.length - 2] as any;
            const prev = coin.candles[coin.candles.length - 3] as any;

            const h = curr.macdHistogram;
            const hPrev = prev.macdHistogram;

            if (h === undefined || hPrev === undefined || h === null || hPrev === null) continue;

            total++;

            if (this.type === 'bull_fade') {
                // histogram is positive but decreasing
                if (h > 0 && h < hPrev) count++;
            } else {
                // histogram is negative but increasing (making less negative)
                if (h < 0 && h > hPrev) count++;
            }
        }

        if (total === 0) return null;

        return {
            key: this.key,
            label: this.label,
            value: count,
            currentPercentage: parseFloat(((count / total) * 100).toFixed(1)),
            coinsCount: total,
        };
    }
}

/**
 * Anomalies based on Z-Score thresholds
 */
export class AnomalyMetric implements IMetric {
    constructor(
        public readonly key: string,
        public readonly label: string,
        private readonly field: 'fundingRateZScore' | 'oiZScore',
        private readonly threshold: number = 2.0
    ) { }

    public compute(data: MarketData): MetricResult | null {
        let count = 0;
        let total = 0;

        for (const coin of data.data) {
            if (!coin.candles || coin.candles.length < 2) continue;
            // Get the last fully completed candle
            const lastCompleted = coin.candles[coin.candles.length - 2] as any;

            const z = lastCompleted[this.field];
            if (z === undefined || z === null || isNaN(z)) continue;

            total++;
            if (Math.abs(z) >= this.threshold) count++;
        }

        if (total === 0) return null;

        return {
            key: this.key,
            label: this.label,
            value: count,
            currentPercentage: parseFloat(((count / total) * 100).toFixed(1)),
            coinsCount: total,
        };
    }
}
