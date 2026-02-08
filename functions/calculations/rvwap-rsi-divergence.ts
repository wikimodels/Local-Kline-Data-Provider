/**
 * Анализ дивергенций между ценой и RSI на RVWAP полосах
 * 
 * Логика:
 * - Bearish Divergence: Цена на хаях (RVWAP Upper Band 1), цена растёт ↗, RSI падает ↘
 * - Bullish Divergence: Цена на дне (RVWAP Lower Band 1), цена падает ↘, RSI растёт ↗
 */

/**
 * Линейная регрессия для расчёта наклона (slope)
 * Возвращает коэффициент наклона 'm' в уравнении y = mx + c
 */
function linearRegressionSlope(y: number[]): number {
    const n = y.length;
    if (n === 0) return 0;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let x = 0; x < n; x++) {
        const val = y[x];
        if (isNaN(val)) return 0;

        sumX += x;
        sumY += val;
        sumXY += x * val;
        sumXX += x * x;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumXX - sumX * sumX;

    if (denominator === 0) return 0;
    return numerator / denominator;
}

/**
 * Анализ RVWAP-RSI дивергенций
 * 
 * @param closePrice - Массив цен закрытия
 * @param rsi - Массив значений RSI
 * @param rvwapUpperBand1 - Верхняя полоса RVWAP (1 SD)
 * @param rvwapLowerBand1 - Нижняя полоса RVWAP (1 SD)
 * @param lookback - Период для расчёта slope (по умолчанию 5)
 * @returns Объект с флагами дивергенций
 */
export function analyzeRvwapRsiDivergence(
    closePrice: number[],
    highPrice: number[],
    lowPrice: number[],
    rsi: number[],
    rvwapUpperBand1: number[],
    rvwapLowerBand1: number[],
    lookback: number = 5
): {
    isBullishRvwapRsiDivergence: boolean[];
    isBearishRvwapRsiDivergence: boolean[];
} {
    const len = closePrice.length;
    const bullishDiv: boolean[] = new Array(len).fill(false);
    const bearishDiv: boolean[] = new Array(len).fill(false);

    // Нужна история для расчёта slope
    if (len < lookback) {
        return {
            isBullishRvwapRsiDivergence: bullishDiv,
            isBearishRvwapRsiDivergence: bearishDiv,
        };
    }

    for (let i = lookback; i < len; i++) {
        // Проверка данных
        const upper1 = rvwapUpperBand1[i];
        const lower1 = rvwapLowerBand1[i];
        const rsiVal = rsi[i];
        const high = highPrice[i];
        const low = lowPrice[i];

        if (
            upper1 == null ||
            lower1 == null ||
            rsiVal == null ||
            isNaN(upper1) ||
            isNaN(lower1) ||
            isNaN(rsiVal)
        ) {
            continue;
        }

        // Собираем массивы за последние lookback свечей
        const prices: number[] = [];
        const rsis: number[] = [];
        let hasNulls = false;

        for (let k = 0; k < lookback; k++) {
            const idx = i - k; // i, i-1, i-2, i-3, i-4
            const candleRsi = rsi[idx];
            const candlePrice = closePrice[idx];

            if (candleRsi == null || isNaN(candleRsi) || isNaN(candlePrice)) {
                hasNulls = true;
                break;
            }

            prices.push(candlePrice);
            rsis.push(candleRsi);
        }

        if (hasNulls) continue;

        // Массивы сейчас [t, t-1, t-2, t-3, t-4]
        // Для регрессии нужно [t-4, t-3, t-2, t-1, t]
        prices.reverse();
        rsis.reverse();

        // Расчёт slope
        const priceSlope = linearRegressionSlope(prices);
        const rsiSlope = linearRegressionSlope(rsis);

        // --- BEARISH DIVERGENCE ---
        // Условия:
        // 1. Цена на хаях (high >= upper band 1)
        // 2. Цена растёт (priceSlope > 0)
        // 3. RSI падает (rsiSlope < 0)
        // 4. RSI всё ещё "горячий" (> 50) - фильтр шума
        const isHigh = high >= upper1;
        const divBear = priceSlope > 0 && rsiSlope < 0;
        const rsiHot = rsiVal > 50;

        if (isHigh && divBear && rsiHot) {
            bearishDiv[i] = true;
        }

        // --- BULLISH DIVERGENCE ---
        // Условия:
        // 1. Цена на дне (low <= lower band 1)
        // 2. Цена падает (priceSlope < 0)
        // 3. RSI растёт (rsiSlope > 0)
        // 4. RSI "холодный" (< 50) - фильтр шума
        const isLow = low <= lower1;
        const divBull = priceSlope < 0 && rsiSlope > 0;
        const rsiCold = rsiVal < 50;

        if (isLow && divBull && rsiCold) {
            bullishDiv[i] = true;
        }
    }

    return {
        isBullishRvwapRsiDivergence: bullishDiv,
        isBearishRvwapRsiDivergence: bearishDiv,
    };
}
