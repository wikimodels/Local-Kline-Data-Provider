// projects/data-core/src/lib/calculations/slope.ts

/**
 * Рассчитывает наклон (Rate of Change) для временного ряда.
 * Чистая функция: принимает ряд значений (number[]) и период.
 * * Наклон (Slope) рассчитывается как абсолютное изменение цены за период,
 * деленное на сам период.
 * * @param series Временной ряд (например, линия EMA или VWAP).
 * @param period Период, за который рассчитывается изменение.
 * @returns Массив со значениями наклона (number[]).
 */
export function calculateSlope(series: number[], period: number): number[] {
  const arrayLength = series.length;
  const slopeValues: number[] = new Array(arrayLength).fill(NaN);

  if (arrayLength < period) return slopeValues;

  for (let i = period; i < arrayLength; i++) {
    // 1. Абсолютное изменение за период: change = series[i] - series[i - period]
    const change = series[i] - series[i - period];

    // 2. Базовый наклон: slope = change / period
    const slope = change / period;

    // 3. Множитель 10000 для удобства отображения
    slopeValues[i] = slope * 10000;
  }

  return slopeValues;
}
