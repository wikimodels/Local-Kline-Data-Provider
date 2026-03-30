// services/metrics/metric.interface.ts
// Core interfaces for the pluggable metric system.

import { MarketData } from "../../models/types.ts";

/**
 * The result of a single metric computation.
 */
export interface MetricResult {
    /** Machine-readable key (matches thresholds.json key) */
    key: string;

    /** Human-readable label for display */
    label: string;

    /** The computed numerical value */
    value: number;

    /** If applicable, the percentage of coins matched */
    currentPercentage?: number;

    /** How many coins contributed to this calculation */
    coinsCount: number;
}

/**
 * Interface every metric class must implement.
 * To add a new metric:
 *  1. Create a new file in services/metrics/
 *  2. Implement this interface
 *  3. Register it in metrics-registry.ts
 */
export interface IMetric {
    /** Unique key — must match the key in thresholds.json */
    key: string;

    /** Human-readable label */
    label: string;

    /**
     * Computes the metric from the given MarketData snapshot.
     * Returns null if the metric cannot be computed (no data etc.)
     */
    compute(data: MarketData): MetricResult | null;
}
