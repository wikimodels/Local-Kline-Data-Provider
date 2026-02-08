/**
 * Анализ дивергенций между ценой и VZO на RVWAP полосах
 * 
 * Логика:
 * - Bearish Divergence: Цена на хаях (RVWAP Upper Band 1), цена растёт ↗, VZO падает ↘ (объём уходит)
 * - Bullish Divergence: Цена на дне (RVWAP Lower Band 1), цена падает ↘, VZO растёт ↗ (объём заходит)
 */

/**
 * Линейная регрессия для расчёта наклона (slope)
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
 * Анализ RVWAP-VZO дивергенций
 * 
 * @param closePrice - Массив цен закрытия
 * @param highPrice - Массив максимумов
 * @param lowPrice - Массив минимумов
 * @param vzo - Массив значений VZO (Volume Zone Oscillator)
 * @param rvwapUpperBand1 - Верхняя полоса RVWAP (1 SD)
 * @param rvwapLowerBand1 - Нижняя полоса RVWAP (1 SD)
 * @param lookback - Период для расчёта slope (по умолчанию 5)
 * @returns Объект с флагами дивергенций
 */
export function analyzeRvwapVzoDivergence(
    closePrice: number[],
    highPrice: number[],
    lowPrice: number[],
    vzo: number[],
    rvwapUpperBand1: number[],
    rvwapLowerBand1: number[],
    lookback: number = 5
): {
    isBullishRvwapVzoDivergence: boolean[];
    isBearishRvwapVzoDivergence: boolean[];
} {
    const len = closePrice.length;
    const bullishDiv: boolean[] = new Array(len).fill(false);
    const bearishDiv: boolean[] = new Array(len).fill(false);

    if (len < lookback) {
        return {
            isBullishRvwapVzoDivergence: bullishDiv,
            isBearishRvwapVzoDivergence: bearishDiv,
        };
    }

    for (let i = lookback; i < len; i++) {
        const upper1 = rvwapUpperBand1[i];
        const lower1 = rvwapLowerBand1[i];
        const vzoVal = vzo[i];
        const high = highPrice[i];
        const low = lowPrice[i];

        if (
            upper1 == null ||
            lower1 == null ||
            vzoVal == null ||
            isNaN(upper1) ||
            isNaN(lower1) ||
            isNaN(vzoVal)
        ) {
            continue;
        }

        // Собираем массивы за последние lookback свечей
        const prices: number[] = [];
        const vzos: number[] = [];
        let hasNulls = false;

        for (let k = 0; k < lookback; k++) {
            const idx = i - k;
            const candleVzo = vzo[idx];
            const candlePrice = closePrice[idx];

            if (candleVzo == null || isNaN(candleVzo) || isNaN(candlePrice)) {
                hasNulls = true;
                break;
            }

            prices.push(candlePrice);
            vzos.push(candleVzo);
        }

        if (hasNulls) continue;

        // Разворачиваем для хронологии [t-4, t-3, t-2, t-1, t]
        prices.reverse();
        vzos.reverse();

        // Расчёт slope
        const priceSlope = linearRegressionSlope(prices);
        const vzoSlope = linearRegressionSlope(vzos);

        // --- BEARISH DIVERGENCE ---
        // Условия:
        // 1. Цена на хаях (high >= upper band 1)
        // 2. Цена растёт (priceSlope > 0)
        // 3. VZO падает (vzoSlope < 0) - объём уходит
        // 4. VZO > 0 (всё ещё в позитивной зоне, но теряем силу)
        const isHigh = high >= upper1;
        const divBear = priceSlope > 0 && vzoSlope < 0;
        const vzoPositive = vzoVal > 0;

        if (isHigh && divBear && vzoPositive) {
            bearishDiv[i] = true;
        }

        // --- BULLISH DIVERGENCE ---
        // Условия:
        // 1. Цена на дне (low <= lower band 1)
        // 2. Цена падает (priceSlope < 0)
        // 3. VZO растёт (vzoSlope > 0) - объём заходит
        // 4. VZO < 0 (в негативной зоне, но набираем силу)
        const isLow = low <= lower1;
        const divBull = priceSlope < 0 && vzoSlope > 0;
        const vzoNegative = vzoVal < 0;

        if (isLow && divBull && vzoNegative) {
            bullishDiv[i] = true;
        }
    }

    return {
        isBullishRvwapVzoDivergence: bullishDiv,
        isBearishRvwapVzoDivergence: bearishDiv,
    };
}
