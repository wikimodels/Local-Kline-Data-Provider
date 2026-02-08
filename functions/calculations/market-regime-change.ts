/**
 * Анализ смены рыночного режима на основе Hurst Exponent и Efficiency Ratio
 * 
 * Логика:
 * - Trending Regime Start: Hurst пересекает 0.5 вверх + ER растёт (тренд формируется)
 * - Mean Reversion Regime Start: Hurst пересекает 0.5 вниз + ER падает (переход в боковик)
 */

export interface HurstValue {
    value: number;
    confidence: number;
}

/**
 * Анализ смены рыночного режима
 * 
 * @param hurst - Массив Hurst Exponent значений {value, confidence}
 * @param efficiencyRatio - Массив Efficiency Ratio (0-1)
 * @param erThreshold - Порог ER для фильтрации (по умолчанию 0.4)
 * @returns Объект с флагами смены режима
 */
export function analyzeMarketRegimeChange(
    hurst: (HurstValue | null)[],
    efficiencyRatio: number[],
    erThreshold: number = 0.4
): {
    isTrendingRegimeStart: boolean[];
    isMeanReversionRegimeStart: boolean[];
} {
    const len = hurst.length;
    const trendingStart: boolean[] = new Array(len).fill(false);
    const meanRevStart: boolean[] = new Array(len).fill(false);

    if (len < 2) {
        return {
            isTrendingRegimeStart: trendingStart,
            isMeanReversionRegimeStart: meanRevStart,
        };
    }

    for (let i = 1; i < len; i++) {
        const currHurst = hurst[i];
        const prevHurst = hurst[i - 1];
        const currER = efficiencyRatio[i];
        const prevER = efficiencyRatio[i - 1];

        // Проверка валидности данных
        if (
            !currHurst ||
            !prevHurst ||
            currER == null ||
            prevER == null ||
            isNaN(currER) ||
            isNaN(prevER)
        ) {
            continue;
        }

        const currH = currHurst.value;
        const prevH = prevHurst.value;

        // --- TRENDING REGIME START ---
        // Условия:
        // 1. Hurst пересекает 0.5 вверх (prevH <= 0.5 && currH > 0.5)
        // 2. ER > порог и растёт (тренд формируется)
        // 3. Confidence достаточная (> 0.5)
        const hurstCrossUp = prevH <= 0.5 && currH > 0.5;
        const erRising = currER > erThreshold && currER > prevER;
        const goodConfidence = currHurst.confidence > 0.5;

        if (hurstCrossUp && erRising && goodConfidence) {
            trendingStart[i] = true;
        }

        // --- MEAN REVERSION REGIME START ---
        // Условия:
        // 1. Hurst пересекает 0.5 вниз (prevH >= 0.5 && currH < 0.5)
        // 2. ER < порог и падает (переход в боковик)
        // 3. Confidence достаточная (> 0.5)
        const hurstCrossDown = prevH >= 0.5 && currH < 0.5;
        const erFalling = currER < erThreshold && currER < prevER;

        if (hurstCrossDown && erFalling && goodConfidence) {
            meanRevStart[i] = true;
        }
    }

    return {
        isTrendingRegimeStart: trendingStart,
        isMeanReversionRegimeStart: meanRevStart,
    };
}
