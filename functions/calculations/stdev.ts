// projects/data-core/src/lib/calculations/stdev.ts

/**
 * Рассчитывает скользящее стандартное отклонение (Standard Deviation) за период.
 * @param series Входной массив цен.
 * @param length Период расчета.
 * @returns Массив значений стандартного отклонения.
 */
export function calculateStDev(series: number[], length: number): number[] {
  const stdev: number[] = new Array(series.length).fill(NaN);

  for (let i = length - 1; i < series.length; i++) {
    const slice = series.slice(i - length + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / length;

    // Сумма квадратов разностей
    const squaredDifferences = slice.map((x) => Math.pow(x - mean, 2));
    const variance = squaredDifferences.reduce((a, b) => a + b, 0) / length;

    // StDev = Корень из дисперсии
    stdev[i] = Math.sqrt(variance);
  }
  return stdev;
}
