/**
 * Анализ Order Flow режимов на основе движения цены и Open Interest
 * 
 * 4 режима:
 * - Long Accumulation: Цена↗ + OI↗ (лонги открываются)
 * - Short Accumulation: Цена↘ + OI↗ (шорты открываются)
 * - Long Liquidation: Цена↘ + OI↘ (лонги ликвидируются)
 * - Short Covering: Цена↗ + OI↘ (шорты закрываются)
 * 
 * ВАЖНО: OI доступен только за последние 30 дней!
 */

/**
 * Анализ Order Flow режимов
 * 
 * @param slopeZClose - Slope Z-Score цены (уже умножен на 10000 в pipeline)
 * @param slopeZOi - Slope Z-Score Open Interest (уже умножен на 10000 в pipeline)
 * @param slopeThreshold - Порог для определения направления (по умолчанию 0)
 * @returns Объект с флагами режимов
 */
export function analyzeOrderFlowRegime(
    slopeZClose: number[],
    slopeZOi: number[],
    slopeThreshold: number = 0
): {
    isLongAccumulation: boolean[];
    isShortAccumulation: boolean[];
    isLongLiquidation: boolean[];
    isShortCovering: boolean[];
} {
    const len = slopeZClose.length;
    const longAcc: boolean[] = new Array(len).fill(false);
    const shortAcc: boolean[] = new Array(len).fill(false);
    const longLiq: boolean[] = new Array(len).fill(false);
    const shortCover: boolean[] = new Array(len).fill(false);

    for (let i = 0; i < len; i++) {
        const rawPriceSlope = slopeZClose[i];
        const rawOiSlope = slopeZOi[i];

        // Проверка валидности данных
        // ВАЖНО: OI может быть null/undefined для старых данных (>30 дней)
        if (
            rawPriceSlope == null ||
            rawOiSlope == null ||
            isNaN(rawPriceSlope) ||
            isNaN(rawOiSlope)
        ) {
            continue;
        }

        // Нормализация slope (в pipeline умножается на 10000)
        const sPrice = rawPriceSlope / 10000;
        const sOi = rawOiSlope / 10000;

        // Определение направления
        const isPriceUp = sPrice > slopeThreshold;
        const isPriceDown = sPrice < -slopeThreshold;
        const isOiUp = sOi > slopeThreshold;
        const isOiDown = sOi < -slopeThreshold;

        // Классификация режима
        if (isPriceUp && isOiUp) {
            // Цена растёт + OI растёт = Лонги накапливаются
            longAcc[i] = true;
        } else if (isPriceDown && isOiUp) {
            // Цена падает + OI растёт = Шорты накапливаются
            shortAcc[i] = true;
        } else if (isPriceDown && isOiDown) {
            // Цена падает + OI падает = Лонги ликвидируются
            longLiq[i] = true;
        } else if (isPriceUp && isOiDown) {
            // Цена растёт + OI падает = Шорты закрываются
            shortCover[i] = true;
        }
        // Если не попадает ни в один режим - остаётся false (нейтральное состояние)
    }

    return {
        isLongAccumulation: longAcc,
        isShortAccumulation: shortAcc,
        isLongLiquidation: longLiq,
        isShortCovering: shortCover,
    };
}
