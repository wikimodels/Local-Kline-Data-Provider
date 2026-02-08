import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает скользящую асимметрию (Rolling Skewness).
 * Показывает "перекос" распределения.
 * > 0: Длинный хвост справа (возможен резкий рост / памп).
 * < 0: Длинный хвост слева (возможен резкий слив / дамп).
 *
 * @param series Данные свечей
 * @param window Размер окна (стандартно 50-100)
 */
export function calculateRollingSkewness(
  series: PriceSeries,
  window: number = 50,
): number[] {
  const data = series.closePrice;
  const length = data.length;
  const result: number[] = new Array(length).fill(NaN);

  if (length < window) return result;

  for (let i = window - 1; i < length; i++) {
    const slice = data.slice(i - window + 1, i + 1);
    const n = slice.length;

    // 1. Среднее
    const sum = slice.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    // 2. Суммы разностей степеней (2 и 3)
    let sumSqDiff = 0;
    let sumCubeDiff = 0;

    for (const val of slice) {
      const diff = val - mean;
      sumSqDiff += diff * diff;
      sumCubeDiff += diff * diff * diff;
    }

    // Стандартное отклонение (смещенное для простоты или несмещенное)
    // Используем стандартную формулу моментов: m3 / m2^(3/2)
    const variance = sumSqDiff / n;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      result[i] = 0;
      continue;
    }

    // 3. Коэффициент асимметрии (Fisher-Pearson moment coefficient)
    // g1 = (sum(x-mean)^3 / n) / stdDev^3
    const m3 = sumCubeDiff / n;
    const skewness = m3 / (stdDev * stdDev * stdDev);

    // *Опционально: можно применить поправку на малую выборку (adjusted Fisher-Pearson),
    // но для окон > 30 разница несущественна для трейдинга.
    // Adjusted = sqrt(n*(n-1))/(n-2) * skewness

    result[i] = skewness;
  }

  return result;
}
