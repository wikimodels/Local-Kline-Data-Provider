/**
 * Анализ изменения slope CMF (Chaikin Money Flow)
 * 
 * Логика:
 * - CMF Slope Up: Slope меняется с отрицательного на положительный (денежный поток усиливается)
 * - CMF Slope Down: Slope меняется с положительного на отрицательный (денежный поток ослабевает)
 * 
 * Преимущества над простым пересечением 0:
 * - Фильтрует шум
 * - Раннее предупреждение (slope меняется раньше, чем CMF пересекает 0)
 * - Меньше ложных сигналов
 */

/**
 * Линейная регрессия для расчёта slope
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
 * Анализ изменения slope CMF
 * 
 * @param cmf - Массив значений CMF
 * @param lookback - Период для расчёта slope (по умолчанию 5)
 * @returns Объект с флагами изменения slope
 */
export function analyzeCmfSlopeChange(
    cmf: number[],
    lookback: number = 5
): {
    isCmfSlopeUp: boolean[];
    isCmfSlopeDown: boolean[];
} {
    const len = cmf.length;
    const slopeUp: boolean[] = new Array(len).fill(false);
    const slopeDown: boolean[] = new Array(len).fill(false);

    // Нужна история для расчёта slope текущего и предыдущего
    if (len < lookback + 1) {
        return {
            isCmfSlopeUp: slopeUp,
            isCmfSlopeDown: slopeDown,
        };
    }

    for (let i = lookback; i < len; i++) {
        // Собираем массивы для текущего и предыдущего slope
        const currentWindow: number[] = [];
        const prevWindow: number[] = [];
        let hasNulls = false;

        // Текущее окно: [i-lookback+1 ... i]
        for (let k = 0; k < lookback; k++) {
            const idx = i - k;
            const val = cmf[idx];

            if (val == null || isNaN(val)) {
                hasNulls = true;
                break;
            }
            currentWindow.push(val);
        }

        // Предыдущее окно: [i-lookback ... i-1]
        if (!hasNulls) {
            for (let k = 1; k <= lookback; k++) {
                const idx = i - k;
                const val = cmf[idx];

                if (val == null || isNaN(val)) {
                    hasNulls = true;
                    break;
                }
                prevWindow.push(val);
            }
        }

        if (hasNulls) continue;

        // Разворачиваем для хронологии
        currentWindow.reverse();
        prevWindow.reverse();

        // Расчёт slope
        const currentSlope = linearRegressionSlope(currentWindow);
        const prevSlope = linearRegressionSlope(prevWindow);

        // --- CMF SLOPE UP ---
        // Slope меняется с отрицательного на положительный
        // Денежный поток начинает усиливаться
        if (prevSlope <= 0 && currentSlope > 0) {
            slopeUp[i] = true;
        }

        // --- CMF SLOPE DOWN ---
        // Slope меняется с положительного на отрицательный
        // Денежный поток начинает ослабевать
        if (prevSlope >= 0 && currentSlope < 0) {
            slopeDown[i] = true;
        }
    }

    return {
        isCmfSlopeUp: slopeUp,
        isCmfSlopeDown: slopeDown,
    };
}
