/**
 * Анализ разворотов тренда на основе RVWAP полос и MACD гистограммы
 * 
 * Логика:
 * - Top Reversal Risk: Цена на хаях, но MACD слабеет (быки выдыхаются)
 * - Bottom Reversal Chance: Цена на дне, но MACD усиливается (медведи выдыхаются)
 */

/**
 * Анализ разворотов моментума на RVWAP полосах
 * 
 * @param closePrice - Массив цен закрытия
 * @param macdHistogram - Массив MACD гистограммы
 * @param rvwapUpperBand1 - Верхняя полоса RVWAP (1 SD)
 * @param rvwapLowerBand1 - Нижняя полоса RVWAP (1 SD)
 * @returns Объект с флагами разворотов
 */
export function analyzeRvwapMomentumReversal(
    closePrice: number[],
    macdHistogram: number[],
    rvwapUpperBand1: number[],
    rvwapLowerBand1: number[]
): {
    isTopReversalRisk: boolean[];
    isBottomReversalChance: boolean[];
} {
    const len = closePrice.length;
    const topRisk: boolean[] = new Array(len).fill(false);
    const bottomChance: boolean[] = new Array(len).fill(false);

    // Нужна предыдущая свеча для сравнения MACD
    if (len < 2) {
        return {
            isTopReversalRisk: topRisk,
            isBottomReversalChance: bottomChance,
        };
    }

    for (let i = 1; i < len; i++) {
        const price = closePrice[i];
        const upper1 = rvwapUpperBand1[i];
        const lower1 = rvwapLowerBand1[i];
        const h = macdHistogram[i];
        const hPrev = macdHistogram[i - 1];

        // Проверка валидности данных
        if (
            price == null ||
            upper1 == null ||
            lower1 == null ||
            h == null ||
            hPrev == null ||
            isNaN(price) ||
            isNaN(upper1) ||
            isNaN(lower1) ||
            isNaN(h) ||
            isNaN(hPrev)
        ) {
            continue;
        }

        // --- TOP REVERSAL RISK ---
        // Условия:
        // 1. Цена выше верхней полосы (дорого)
        // 2. MACD гистограмма > 0 (бычий моментум)
        // 3. MACD гистограмма падает (h < hPrev) - моментум слабеет
        const isExpensive = price > upper1;
        const isFadingBull = h > 0 && h < hPrev;

        if (isExpensive && isFadingBull) {
            topRisk[i] = true;
        }

        // --- BOTTOM REVERSAL CHANCE ---
        // Условия:
        // 1. Цена ниже нижней полосы (дёшево)
        // 2. MACD гистограмма < 0 (медвежий моментум)
        // 3. MACD гистограмма растёт (h > hPrev) - моментум слабеет
        const isCheap = price < lower1;
        const isFadingBear = h < 0 && h > hPrev;

        if (isCheap && isFadingBear) {
            bottomChance[i] = true;
        }
    }

    return {
        isTopReversalRisk: topRisk,
        isBottomReversalChance: bottomChance,
    };
}
