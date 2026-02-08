/**
 * Анализ истощения волатильности
 * 
 * Логика:
 * Высокая волатильность (Kurtosis > 5) достигла пика и начинает падать,
 * при этом тренд (Hurst > 0.6) теряет силу (ER падает).
 * Это сигнал возможного разворота после экстремального движения.
 */

export interface HurstValue {
    value: number;
    confidence: number;
}

/**
 * Анализ истощения волатильности
 * 
 * @param kurtosis - Массив Kurtosis значений
 * @param hurst - Массив Hurst Exponent значений
 * @param efficiencyRatio - Массив Efficiency Ratio
 * @param kurtosisThreshold - Порог Kurtosis для высокой волатильности (по умолчанию 5)
 * @param hurstThreshold - Порог Hurst для трендового режима (по умолчанию 0.6)
 * @returns Объект с флагом истощения волатильности
 */
export function analyzeVolatilityExhaustion(
    kurtosis: number[],
    hurst: (HurstValue | null)[],
    efficiencyRatio: number[],
    kurtosisThreshold: number = 5,
    hurstThreshold: number = 0.6
): {
    isVolatilityExhaustion: boolean[];
} {
    const len = kurtosis.length;
    const exhaustion: boolean[] = new Array(len).fill(false);

    if (len < 2) {
        return {
            isVolatilityExhaustion: exhaustion,
        };
    }

    for (let i = 1; i < len; i++) {
        const currKurt = kurtosis[i];
        const prevKurt = kurtosis[i - 1];
        const currHurst = hurst[i];
        const currER = efficiencyRatio[i];
        const prevER = efficiencyRatio[i - 1];

        // Проверка валидности данных
        if (
            currKurt == null ||
            prevKurt == null ||
            !currHurst ||
            currER == null ||
            prevER == null ||
            isNaN(currKurt) ||
            isNaN(prevKurt) ||
            isNaN(currER) ||
            isNaN(prevER)
        ) {
            continue;
        }

        // --- VOLATILITY EXHAUSTION ---
        // Условия:
        // 1. Kurtosis > порог (высокая волатильность)
        // 2. Kurtosis падает (пик пройден)
        // 3. Hurst > порог (был трендовый режим)
        // 4. ER падает (тренд теряет силу)
        const highVolatility = currKurt > kurtosisThreshold;
        const kurtFalling = currKurt < prevKurt;
        const wasTrending = currHurst.value > hurstThreshold;
        const erFalling = currER < prevER;

        if (highVolatility && kurtFalling && wasTrending && erFalling) {
            exhaustion[i] = true;
        }
    }

    return {
        isVolatilityExhaustion: exhaustion,
    };
}
