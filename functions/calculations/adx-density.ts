import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает ADX Density (Плотность тренда).
 *
 * Логика:
 * В скользящем окне считаем количество баров, где ADX > threshold.
 * Результат = Count / WindowSize.
 *
 * @param adxValues Массив значений ADX (рассчитанный ранее)
 * @param window Размер окна проверки (например, 90 для квартального тренда на D1)
 * @param threshold Порог тренда (стандартно 25)
 */
export function calculateAdxDensity(
  adxValues: number[],
  window: number = 90,
  threshold: number = 25,
): number[] {
  const n = adxValues.length;
  const result: number[] = new Array(n).fill(NaN);

  if (n < window) return result;

  // Используем скользящее окно
  // Оптимизация: можно хранить текущий count и обновлять его (add new, remove old),
  // но для надежности с NaN значениями проще пересчитывать в цикле (для 400 свечей это мгновенно).

  for (let i = window - 1; i < n; i++) {
    let trendCount = 0;
    let validCandles = 0;

    for (let j = 0; j < window; j++) {
      const val = adxValues[i - j];

      // Пропускаем NaN (если ADX еще не рассчитался в начале истории)
      if (!Number.isNaN(val)) {
        validCandles++;
        if (val > threshold) {
          trendCount++;
        }
      }
    }

    if (validCandles > 0) {
      result[i] = trendCount / validCandles;
    } else {
      result[i] = 0;
    }
  }

  return result;
}
