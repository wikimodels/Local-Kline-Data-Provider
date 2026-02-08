/**
 * Анализ разворотов на основе экстремальной асимметрии (Skewness)
 * 
 * Логика:
 * - Bullish Reversal: Экстремальный negative skew (<-1.5) на дне (RVWAP Lower Band)
 *   → Много падений, но цена на дне - возможен отскок
 * - Bearish Reversal: Экстремальный positive skew (>1.5) на хаях (RVWAP Upper Band)
 *   → Много роста, но цена на хаях - возможен откат
 */

/**
 * Анализ разворотов по асимметрии
 * 
 * @param closePrice - Массив цен закрытия
 * @param skewness - Массив Skewness значений
 * @param rvwapUpperBand1 - Верхняя полоса RVWAP (1 SD)
 * @param rvwapLowerBand1 - Нижняя полоса RVWAP (1 SD)
 * @param skewThreshold - Порог экстремальной асимметрии (по умолчанию 1.5)
 * @returns Объект с флагами разворотов
 */
export function analyzeSkewReversal(
    closePrice: number[],
    skewness: number[],
    rvwapUpperBand1: number[],
    rvwapLowerBand1: number[],
    skewThreshold: number = 1.5
): {
    isBullishSkewReversal: boolean[];
    isBearishSkewReversal: boolean[];
} {
    const len = closePrice.length;
    const bullishRev: boolean[] = new Array(len).fill(false);
    const bearishRev: boolean[] = new Array(len).fill(false);

    for (let i = 0; i < len; i++) {
        const price = closePrice[i];
        const skew = skewness[i];
        const upper = rvwapUpperBand1[i];
        const lower = rvwapLowerBand1[i];

        // Проверка валидности данных
        if (
            price == null ||
            skew == null ||
            upper == null ||
            lower == null ||
            isNaN(price) ||
            isNaN(skew) ||
            isNaN(upper) ||
            isNaN(lower)
        ) {
            continue;
        }

        // --- BULLISH SKEW REVERSAL ---
        // Условия:
        // 1. Skewness < -skewThreshold (экстремальный negative skew)
        // 2. Цена на дне (price <= RVWAP Lower Band 1)
        const extremeNegativeSkew = skew < -skewThreshold;
        const atBottom = price <= lower;

        if (extremeNegativeSkew && atBottom) {
            bullishRev[i] = true;
        }

        // --- BEARISH SKEW REVERSAL ---
        // Условия:
        // 1. Skewness > skewThreshold (экстремальный positive skew)
        // 2. Цена на хаях (price >= RVWAP Upper Band 1)
        const extremePositiveSkew = skew > skewThreshold;
        const atTop = price >= upper;

        if (extremePositiveSkew && atTop) {
            bearishRev[i] = true;
        }
    }

    return {
        isBullishSkewReversal: bullishRev,
        isBearishSkewReversal: bearishRev,
    };
}
