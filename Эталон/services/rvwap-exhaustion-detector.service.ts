import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { EChartsOption } from 'echarts';
import { KlineDataService, Timeframe } from '../../shared/services/kline-data.service';
import { MarketData, Candle } from '../../models/kline.model';
import { WorkingCoin } from '../../shared/models/working-coin.model';

// --- TYPES ---

export interface ExhaustionCoin {
    symbol: string;
    score: number; // 0.0 - 1.0
    reasons: string[];
    price: number;
    fundingRate?: number;
    rsi?: number;
    entropy?: number;
}

export interface ExhaustionTableRow {
    openTime: number;
    coins: ExhaustionCoin[];
}

export interface MarketExhaustionState {
    timeframe: string;
    timestamp: number;
    bullsExhausted: number;
    bearsExhausted: number;
    avgBullExhaustionScore: number;
    avgBearExhaustionScore: number;
    topBullReasons: { reason: string; count: number }[];
    topBearReasons: { reason: string; count: number }[];
    marketSentiment: 'NEUTRAL' | 'BEARISH EXHAUSTION' | 'BULLISH EXHAUSTION';
    reversalProbability: number;
}

@Injectable({ providedIn: 'root' })
export class RvwapExhaustionDetectorService {

    private klineService = inject(KlineDataService);

    // === 3. AGGREGATED CHART WIDGET ===
    public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
        const charts: Record<string, EChartsOption> = {};

        allMarketData.forEach((marketData, timeframe) => {
            // Calculate historical counts of exhausted bulls/bears
            const history = this.calculateHistoricalExhaustion(marketData);
            charts[timeframe] = this.buildChart(history, timeframe);
        });

        return charts;
    }

    // === 1. INDIVIDUAL ANALYSIS (Last 20 candles) ===
    public getExhaustionSignals(
        timeframe: Timeframe,
        side: 'bulls' | 'bears'
    ): Observable<ExhaustionTableRow[]> {
        return from(this.klineService.getKlines(timeframe)).pipe(
            map((marketData) => {
                if (!marketData?.data) return [];
                return this.extractExhaustionRows(marketData, side, timeframe);
            })
        );
    }

    // === 2. AGGREGATED ANALYSIS (Market Snapshot) ===
    public getMarketExhaustionState(
        timeframe: Timeframe
    ): Observable<MarketExhaustionState> {
        return from(this.klineService.getKlines(timeframe)).pipe(
            map((marketData) => {
                if (!marketData?.data) return this.emptyState(timeframe);
                return this.aggregateMarketExhaustion(marketData, timeframe);
            })
        );
    }

    // ============================================
    // INDIVIDUAL ANALYSIS IMPLEMENTATION
    // ============================================

    private extractExhaustionRows(
        marketData: MarketData,
        side: 'bulls' | 'bears',
        timeframe: string
    ): ExhaustionTableRow[] {
        const exhaustionMap = new Map<number, ExhaustionCoin[]>();

        for (const coinData of marketData.data) {
            if (!coinData.candles || coinData.candles.length < 50) continue;

            // Iterate last 20 candles
            const recentCandles = coinData.candles.slice(-20);

            for (const candle of recentCandles) {
                // RVWAP Band Check: Must be AT or BEYOND Band 1
                const atUpperBand = candle.highPrice >= (candle.rvwapUpperBand1 ?? Infinity);
                const atLowerBand = candle.lowPrice <= (candle.rvwapLowerBand1 ?? -Infinity);

                const atBand = side === 'bulls' ? atUpperBand : atLowerBand;

                if (!atBand) continue;

                // Detect Exhaustion
                const exhaustion = this.detectExhaustion(
                    coinData.candles,
                    side === 'bulls' ? 'upper' : 'lower',
                    timeframe,
                    candle.openTime
                );

                if (exhaustion.score >= 0.7) {
                    const openTime = candle.openTime;

                    if (!exhaustionMap.has(openTime)) {
                        exhaustionMap.set(openTime, []);
                    }

                    exhaustionMap.get(openTime)!.push({
                        symbol: coinData.symbol,
                        score: exhaustion.score,
                        reasons: exhaustion.reasons,
                        price: candle.closePrice,
                        fundingRate: candle.fundingRate ?? 0,
                        rsi: candle.rsi ?? 0,
                        entropy: candle.entropy20 ?? 0,
                    });

                    // Break to avoid cluttering the table with adjacent candles for the same coin?
                    // User logic: "break; // Один сигнал на монету"
                    break;
                }
            }
        }

        // Sort: Newest time first
        const rows: ExhaustionTableRow[] = Array.from(exhaustionMap.entries())
            .map(([openTime, coins]) => ({
                openTime,
                coins: coins.sort((a, b) => b.score - a.score),
            }))
            .sort((a, b) => b.openTime - a.openTime)
            .slice(0, 20);

        return rows;
    }

    // ============================================
    // AGGREGATED ANALYSIS IMPLEMENTATION
    // ============================================

    private aggregateMarketExhaustion(
        marketData: MarketData,
        timeframe: string
    ): MarketExhaustionState {
        let bullsExhausted = 0;
        let bearsExhausted = 0;

        const bullExhaustionScores: number[] = [];
        const bearExhaustionScores: number[] = [];

        const topBullReasons = new Map<string, number>();
        const topBearReasons = new Map<string, number>();

        // Analyze ONLY the last closed candle? Or current? 
        // Usually "Market State" refers to right now.
        // Let's use the LAST candle in the array.
        for (const coinData of marketData.data) {
            if (!coinData.candles || coinData.candles.length < 50) continue;
            const last = coinData.candles[coinData.candles.length - 1];

            // BULLS (Upper Band)
            if (last.highPrice >= (last.rvwapUpperBand1 ?? Infinity)) {
                const exhaustion = this.detectExhaustion(coinData.candles, 'upper', timeframe, last.openTime);
                if (exhaustion.score >= 0.7) {
                    bullsExhausted++;
                    bullExhaustionScores.push(exhaustion.score);
                    exhaustion.reasons.forEach(r => {
                        // Normalize reason string to group them (remove emojis or specific values if needed)
                        // Keep simple classification
                        const key = r.split(':')[0].trim();
                        topBullReasons.set(key, (topBullReasons.get(key) || 0) + 1);
                    });
                }
            }

            // BEARS (Lower Band)
            if (last.lowPrice <= (last.rvwapLowerBand1 ?? -Infinity)) {
                const exhaustion = this.detectExhaustion(coinData.candles, 'lower', timeframe, last.openTime);
                if (exhaustion.score >= 0.7) {
                    bearsExhausted++;
                    bearExhaustionScores.push(exhaustion.score);
                    exhaustion.reasons.forEach(r => {
                        const key = r.split(':')[0].trim();
                        topBearReasons.set(key, (topBearReasons.get(key) || 0) + 1);
                    });
                }
            }
        }

        const avgBullScore = bullExhaustionScores.length > 0
            ? bullExhaustionScores.reduce((a, b) => a + b, 0) / bullExhaustionScores.length
            : 0;

        const avgBearScore = bearExhaustionScores.length > 0
            ? bearExhaustionScores.reduce((a, b) => a + b, 0) / bearExhaustionScores.length
            : 0;

        let marketSentiment: 'NEUTRAL' | 'BEARISH EXHAUSTION' | 'BULLISH EXHAUSTION' = 'NEUTRAL';
        let reversalProbability = 0;

        // Logic: If one side is > 2x the other and has high conviction
        if (bullsExhausted > Math.max(bearsExhausted * 2, 5) && avgBullScore > 0.75) {
            marketSentiment = 'BEARISH EXHAUSTION'; // Bulls are exhausted -> Bearish reversal
            reversalProbability = avgBullScore;
        } else if (bearsExhausted > Math.max(bullsExhausted * 2, 5) && avgBearScore > 0.75) {
            marketSentiment = 'BULLISH EXHAUSTION'; // Bears are exhausted -> Bullish reversal
            reversalProbability = avgBearScore;
        }

        return {
            timeframe,
            timestamp: Date.now(),
            bullsExhausted,
            bearsExhausted,
            avgBullExhaustionScore: avgBullScore,
            avgBearExhaustionScore: avgBearScore,
            topBullReasons: this.topN(topBullReasons, 5),
            topBearReasons: this.topN(topBearReasons, 5),
            marketSentiment,
            reversalProbability
        };
    }

    // ============================================
    // CORE EXHAUSTION LOGIC
    // ============================================

    private detectExhaustion(
        candles: Candle[],
        side: 'upper' | 'lower',
        timeframe: string,
        targetTime: number
    ): { score: number, reasons: string[] } {

        // Find target candle
        const index = candles.findIndex(c => c.openTime === targetTime);
        if (index < 5) return { score: 0, reasons: [] };

        const candle = candles[index];
        let totalScore = 0;
        const allReasons: string[] = [];

        // 1. DIVERGENCES — читаем готовые флаги из пайплайна
        const divs = this.readDivergenceFlags(candle, side);
        if (divs.rsi) { totalScore += 0.30; allReasons.push('🔴 RSI Div'); }
        if (divs.cmf) { totalScore += 0.25; allReasons.push('🔴 CMF Div'); }
        if (divs.vzo) { totalScore += 0.25; allReasons.push('🔴 VZO Div'); }

        // 2. FUNDING RATE (8h only, or general high funding check)
        if (timeframe === '8h' || timeframe === '4h') {
            const funding = this.analyzeFundingRate(candle, side);
            totalScore += funding.score * 0.20;
            if (funding.score > 0) allReasons.push(...funding.reasons);
        }

        // 3. ENTROPY (Instability)
        const entropy = this.analyzeEntropyContext(candle);
        totalScore += entropy.score * 0.12;
        if (entropy.score > 0) allReasons.push(...entropy.reasons);

        // 4. RVWAP Band Behavior (Over-extension)
        const rvwap = this.analyzeRVWAPBandBehavior(candle, side);
        totalScore += rvwap.score * 0.10;
        if (rvwap.score > 0) allReasons.push(...rvwap.reasons);

        // 5. EMA Structure (Trend maturity)
        const ema = this.analyzeEMAStructure(candle, side);
        totalScore += ema.score * 0.08;
        if (ema.score > 0) allReasons.push(...ema.reasons);

        // 6. Price Z-Score (Statistical outlier)
        const zScore = this.analyzePriceZScore(candle);
        totalScore += zScore.score * 0.05;
        if (zScore.score > 0) allReasons.push(...zScore.reasons);

        return {
            score: Math.min(totalScore, 1.0),
            reasons: allReasons
        };
    }

    // --- HELPER METRICS ---

    private analyzeFundingRate(candle: any, side: 'upper' | 'lower'): { score: number, reasons: string[] } {
        // Logic: High positive funding (> 0.01%) suggests Long crowding -> Bearish signal if at Resistance (Upper)
        // Low negative funding (< -0.01%) suggests Short crowding -> Bullish signal if at Support (Lower)

        if (!candle.fundingRate) return { score: 0, reasons: [] };
        const fr = candle.fundingRate;

        if (side === 'upper') {
            // We are at tops. If FR is high positive, longs are paying shorts -> Crowded Longs -> Reversal risk
            if (fr >= 0.05) return { score: 1.0, reasons: [`High Funding (${fr.toFixed(3)}%)`] };
            if (fr >= 0.01) return { score: 0.5, reasons: [`Positive Funding`] };
        }

        if (side === 'lower') {
            // We are at bottoms. If FR is high negative, shorts are paying longs -> Crowded Shorts -> Squeeze risk
            if (fr <= -0.05) return { score: 1.0, reasons: [`Neg Funding (${fr.toFixed(3)}%)`] };
            if (fr <= -0.01) return { score: 0.5, reasons: [`Negative Funding`] };
        }

        return { score: 0, reasons: [] };
    }

    private analyzeEntropyContext(candle: any): { score: number, reasons: string[] } {
        // Logic: High entropy usually signals market regime shift or chaos
        if (!candle.entropy20) return { score: 0, reasons: [] };

        const e = candle.entropy20;
        // Assume normalized entropy around 3.0? Or 1.0? 
        // User prompt says 'entropy', typically Shannon entropy on n=20.
        // Let's assume > 3.0 is high, < 2.0 is low (just heuristics). 
        // Note: without distribution knowledge, we check for 'high' relative to typical.
        // Let's guess threshold 2.8 for "High".
        if (e > 3.5) return { score: 1.0, reasons: [`Extreme Entropy`] };
        if (e > 3.0) return { score: 0.5, reasons: [`High Entropy`] };

        return { score: 0, reasons: [] };
    }

    private analyzeRVWAPBandBehavior(candle: any, side: 'upper' | 'lower'): { score: number, reasons: string[] } {
        // If price is pushing WAY beyond Band 2 or 3, it's extreme exhaustion
        const close = candle.closePrice;
        const upper2 = candle.rvwapUpperBand2 ?? Infinity;
        const lower2 = candle.rvwapLowerBand2 ?? -Infinity;
        const upper3 = candle.rvwapUpperBand3 ?? Infinity;
        const lower3 = candle.rvwapLowerBand3 ?? -Infinity;

        if (side === 'upper') {
            if (close >= upper3) return { score: 1.0, reasons: ['Band 3 Breach'] };
            if (close >= upper2) return { score: 0.5, reasons: ['Band 2 Breach'] };
        }

        if (side === 'lower') {
            if (close <= lower3) return { score: 1.0, reasons: ['Band 3 Breach'] };
            if (close <= lower2) return { score: 0.5, reasons: ['Band 2 Breach'] };
        }

        return { score: 0, reasons: [] };
    }

    private analyzeEMAStructure(candle: any, side: 'upper' | 'lower'): { score: number, reasons: string[] } {
        // Check for large deviation from EMA200 or similar?
        // Or EMA Fan spread?
        // Let's use simple logic: Distance from EMA50.
        // If price is too far from EMA, it reverts.
        const ema = candle.ema50;
        if (!ema) return { score: 0, reasons: [] };

        const diff = Math.abs((candle.closePrice - ema) / ema) * 100; // % diff
        if (diff > 15) return { score: 1.0, reasons: ['Overextended EMA'] };
        if (diff > 8) return { score: 0.5, reasons: ['Wide EMA Gap'] };

        return { score: 0, reasons: [] };
    }

    private analyzePriceZScore(candle: any): { score: number, reasons: string[] } {
        const z = candle.closePriceZScore;
        if (z == null) return { score: 0, reasons: [] };

        const absZ = Math.abs(z);
        if (absZ > 3) return { score: 1.0, reasons: [`Z-Score > 3 (${z.toFixed(1)})`] };
        if (absZ > 2) return { score: 0.5, reasons: [`Z-Score > 2`] };

        return { score: 0, reasons: [] };
    }


    // --- DIVERGENCE FLAGS (читаем из пайплайна) ---

    /**
     * Читает готовые флаги дивергенции RVWAP из candle (записаны пайплайном).
     * side='upper' → медвежья дивергенция (isBearishRvwap*)
     * side='lower' → бычья дивергенция (isBullishRvwap*)
     */
    private readDivergenceFlags(
        candle: any,
        side: 'upper' | 'lower'
    ): { rsi: boolean; cmf: boolean; vzo: boolean } {
        if (side === 'upper') {
            return {
                rsi: !!candle.isBearishRvwapRsiDivergence,
                cmf: !!candle.isBearishRvwapCmfDivergence,
                vzo: !!candle.isBearishRvwapVzoDivergence,
            };
        } else {
            return {
                rsi: !!candle.isBullishRvwapRsiDivergence,
                cmf: !!candle.isBullishRvwapCmfDivergence,
                vzo: !!candle.isBullishRvwapVzoDivergence,
            };
        }
    }

    private emptyState(timeframe: string): MarketExhaustionState {
        return {
            timeframe,
            timestamp: Date.now(),
            bullsExhausted: 0,
            bearsExhausted: 0,
            avgBullExhaustionScore: 0,
            avgBearExhaustionScore: 0,
            topBullReasons: [],
            topBearReasons: [],
            marketSentiment: 'NEUTRAL',
            reversalProbability: 0
        };
    }

    // === HELPER METHODS FOR AGGREGATED CHART ===

    private calculateHistoricalExhaustion(marketData: MarketData) {
        // Map: openTime -> { bulls: number, bears: number }
        const timeMap = new Map<number, { bulls: number; bears: number; total: number }>();

        for (const coinData of marketData.data) {
            if (!coinData.candles || coinData.candles.length < 50) continue;

            // Iterate ALL candles (skipping first 50 for warmup)
            for (let i = 50; i < coinData.candles.length; i++) {
                const candle = coinData.candles[i];
                const openTime = candle.openTime;

                if (!timeMap.has(openTime)) {
                    timeMap.set(openTime, { bulls: 0, bears: 0, total: 0 });
                }
                const counts = timeMap.get(openTime)!;
                counts.total++;

                // FAST CHECK: Is candle at band?
                const atUpper = candle.highPrice >= (candle.rvwapUpperBand1 ?? Infinity);
                const atLower = candle.lowPrice <= (candle.rvwapLowerBand1 ?? -Infinity);

                if (atUpper) {
                    // Check exhaustion
                    // Note: using detectExhaustion on every candle for every coin is heavy.
                    // Optimization: Check quick proxies first. 
                    // If RSI < 50 while at Upper Band -> Likely Bearish Divergence -> Exhaustion
                    // If Entropy is high -> Exhaustion
                    // Let's use the full check but maybe simplified if performance is an issue.
                    // For now, full check.
                    const res = this.detectExhaustion(coinData.candles, 'upper', marketData.timeframe, openTime);
                    if (res.score >= 0.7) counts.bulls++;
                }

                if (atLower) {
                    const res = this.detectExhaustion(coinData.candles, 'lower', marketData.timeframe, openTime);
                    if (res.score >= 0.7) counts.bears++;
                }
            }
        }

        // Convert to sorted array
        const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

        return {
            dates: sortedTimes,
            bulls: sortedTimes.map(t => timeMap.get(t)!.bulls),
            bears: sortedTimes.map(t => timeMap.get(t)!.bears),
            totals: sortedTimes.map(t => timeMap.get(t)!.total)
        };
    }

    private buildChart(data: any, tf: string): EChartsOption {
        if (data.dates.length === 0) return {};

        const fmt = new Intl.DateTimeFormat('en-GB', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

        const dates = data.dates.map((t: number) => fmt.format(new Date(t)));

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                backgroundColor: 'rgba(20, 20, 25, 0.95)',
                borderColor: '#333',
                textStyle: { color: '#fff' },
            },
            legend: {
                data: ['Bulls Exhausted (Reversal ↓)', 'Bears Exhausted (Reversal ↑)'],
                top: 0,
                textStyle: { color: '#ccc' }
            },
            grid: { left: '3%', right: '3%', bottom: '5%', top: '12%', containLabel: true },
            xAxis: {
                type: 'category',
                data: dates,
                axisLine: { lineStyle: { color: '#444' } },
                axisLabel: { color: '#888' },
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
                axisLabel: { color: '#888' },
            },
            series: [
                {
                    name: 'Bulls Exhausted (Reversal ↓)',
                    type: 'bar',
                    stack: 'total',
                    data: data.bulls,
                    itemStyle: { color: '#ef5350' }, // Red for bulls exhausted (bearish signal)
                },
                {
                    name: 'Bears Exhausted (Reversal ↑)',
                    type: 'bar',
                    stack: 'total',
                    data: data.bears.map((v: number) => -v), // Negative for visual symmetry
                    itemStyle: { color: '#66bb6a' }, // Green for bears exhausted (bullish signal)
                }
            ]
        };
    }

    private topN(map: Map<string, number>, n: number) {
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([reason, count]) => ({ reason, count }));
    }
}
