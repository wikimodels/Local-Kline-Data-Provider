import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает Chaikin Money Flow (CMF).
 * @param series Объект числовых серий.
 * @param length Период для CMF (стандартно 20).
 */
export function calculateCMF(series: PriceSeries, length: number = 20) {
  const arrayLength = series.closePrice.length;
  const cmfValues: number[] = new Array(arrayLength).fill(NaN);

  if (arrayLength < length) {
    return { cmf: cmfValues };
  }

  // 1. Рассчитываем MFM и MFV для каждой свечи
  const moneyFlowVolume: number[] = new Array(arrayLength).fill(0);
  for (let i = 0; i < arrayLength; i++) {
    const mfm = calculateMFM(
      series.highPrice[i],
      series.lowPrice[i],
      series.closePrice[i],
    );
    moneyFlowVolume[i] = mfm * series.volume[i];
  }

  // 2. Рассчитываем CMF итеративно
  for (let i = length - 1; i < arrayLength; i++) {
    // Числитель: Сумма MFV за период
    let sumMFV = 0;
    for (let j = i - length + 1; j <= i; j++) {
      sumMFV += moneyFlowVolume[j];
    }

    // Знаменатель: Сумма Volume за период
    let sumVolume = 0;
    for (let j = i - length + 1; j <= i; j++) {
      sumVolume += series.volume[j];
    }

    // CMF = Sum(MFV) / Sum(Volume)
    if (sumVolume !== 0) {
      cmfValues[i] = sumMFV / sumVolume;
    } else {
      cmfValues[i] = 0;
    }
  }

  return { cmf: cmfValues };
}

// projects/data-core/src/lib/calculations/cmf.ts (Часть 1)

/**
 * Рассчитывает Money Flow Multiplier (MFM).
 * MFM = ((Close - Low) - (High - Close)) / (High - Low)
 */
function calculateMFM(high: number, low: number, close: number): number {
  const range = high - low;
  if (range === 0) {
    return 0; // Предотвращение деления на ноль, если цена не двигалась
  }

  // Числитель: (Close - Low) - (High - Close) = 2*Close - High - Low
  const numerator = close - low - (high - close);

  return numerator / range;
}
