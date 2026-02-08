/**
 * Анализ дивергенций между ценой и CMF на RVWAP полосах
 * 
 * Логика:
 * - Bearish Divergence: Цена на хаях (RVWAP Upper Band 1), цена растёт ↗, CMF падает ↘ (деньги уходят)
 * - Bullish Divergence: Цена на дне (RVWAP Lower Band 1), цена падает ↘, CMF растёт ↗ (деньги заходят)
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
 * Анализ RVWAP-CMF дивергенций
 * 
 * @param closePrice - Массив цен закрытия
 * @param highPrice - Массив максимумов
 * @param lowPrice - Массив минимумов
 * @param cmf - Массив значений CMF (Chaikin Money Flow)
 * @param rvwapUpperBand1 - Верхняя полоса RVWAP (1 SD)
 * @param rvwapLowerBand1 - Нижняя полоса RVWAP (1 SD)
 * @param lookback - Период для расчёта slope (по умолчанию 5)
 * @returns Объект с флагами дивергенций
 */
export function analyzeRvwapCmfDivergence(
    closePrice: number[],
    highPrice: number[],
    lowPrice: number[],
    cmf: number[],
    rvwapUpperBand1: number[],
    rvwapLowerBand1: number[],
    lookback: number = 5
): {
    isBullishRvwapCmfDivergence: boolean[];
    isBearishRvwapCmfDivergence: boolean[];
} {
    const len = closePrice.length;
    const bullishDiv: boolean[] = new Array(len).fill(false);
    const bearishDiv: boolean[] = new Array(len).fill(false);

    if (len < lookback) {
        return {
            isBullishRvwapCmfDivergence: bullishDiv,
            isBearishRvwapCmfDivergence: bearishDiv,
        };
    }

    for (let i = lookback; i < len; i++) {
        const upper1 = rvwapUpperBand1[i];
        const lower1 = rvwapLowerBand1[i];
        const cmfVal = cmf[i];
        const high = highPrice[i];
        const low = lowPrice[i];

        if (
            upper1 == null ||
            lower1 == null ||
            cmfVal == null ||
            isNaN(upper1) ||
            isNaN(lower1) ||
            isNaN(cmfVal)
        ) {
            continue;
        }

        // Собираем массивы за последние lookback свечей
        const prices: number[] = [];
        const cmfs: number[] = [];
        let hasNulls = false;

        for (let k = 0; k < lookback; k++) {
            const idx = i - k;
            const candleCmf = cmf[idx];
            const candlePrice = closePrice[idx];

            if (candleCmf == null || isNaN(candleCmf) || isNaN(candlePrice)) {
                hasNulls = true;
                break;
            }

            prices.push(candlePrice);
            cmfs.push(candleCmf);
        }

        if (hasNulls) continue;

        // Разворачиваем для хронологии [t-4, t-3, t-2, t-1, t]
        prices.reverse();
        cmfs.reverse();

        // Расчёт slope
        const priceSlope = linearRegressionSlope(prices);
        const cmfSlope = linearRegressionSlope(cmfs);

        // --- BEARISH DIVERGENCE ---
        // Условия:
        // 1. Цена на хаях (high >= upper band 1)
        // 2. Цена растёт (priceSlope > 0)
        // 3. CMF падает (cmfSlope < 0) - деньги уходят
        // 4. CMF > 0 (всё ещё в позитивной зоне, но слабеет)
        const isHigh = high >= upper1;
        const divBear = priceSlope > 0 && cmfSlope < 0;
        const cmfPositive = cmfVal > 0;

        if (isHigh && divBear && cmfPositive) {
            bearishDiv[i] = true;
        }

        // --- BULLISH DIVERGENCE ---
        // Условия:
        // 1. Цена на дне (low <= lower band 1)
        // 2. Цена падает (priceSlope < 0)
        // 3. CMF растёт (cmfSlope > 0) - деньги заходят
        // 4. CMF < 0 (в негативной зоне, но усиливается)
        const isLow = low <= lower1;
        const divBull = priceSlope < 0 && cmfSlope > 0;
        const cmfNegative = cmfVal < 0;

        if (isLow && divBull && cmfNegative) {
            bullishDiv[i] = true;
        }
    }

    return {
        isBullishRvwapCmfDivergence: bullishDiv,
        isBearishRvwapCmfDivergence: bearishDiv,
    };
}
