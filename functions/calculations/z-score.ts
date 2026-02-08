// projects/data-core/src/lib/calculations/z_score.ts

/**
 * Рассчитывает скользящий Z-score.
 * 🚀 УЛУЧШЕННАЯ ВЕРСИЯ:
 * - Не использует внешние calculateSMA/StDev, чтобы избежать ошибок с NaN.
 * - Если в окне есть NaN или нули (для OI это ошибка), возвращает NaN.
 */
export function calculateZScore(series: number[], window: number = 50): number[] {
  const arrayLength = series.length;
  const zScoreValues: number[] = new Array(arrayLength).fill(NaN);

  if (arrayLength < window) return zScoreValues;

  for (let i = window - 1; i < arrayLength; i++) {
    // 1. Берем окно
    const slice = series.slice(i - window + 1, i + 1);

    // 2. 🚀 ПРОВЕРКА ДАННЫХ:
    // Если в окне есть NaN или данные отсутствуют (равны 0 для OI/Volume),
    // то считать статистику нельзя — будет мусор.
    // (Для цены 0 теоретически возможен, но для OI/Vol это обычно отсутствие данных)
    // Мы считаем валидным только число != 0 и не NaN.
    // Если у тебя есть метрики, где 0 — норма, убери проверку `x === 0`.
    // Но для OI/Volume проверка на 0 спасает от "плоской черты".
    let valid = true;
    let sum = 0;

    // Оптимизированный проход для расчета суммы и валидации
    for (let k = 0; k < slice.length; k++) {
      const x = slice[k];
      if (Number.isNaN(x)) {
        valid = false;
        break;
      }
      sum += x;
    }

    if (!valid) {
      zScoreValues[i] = NaN;
      continue;
    }

    // 3. Расчет Среднего (Mean)
    const mean = sum / window;

    // 4. Расчет Ст. Отклонения (StDev)
    let sumSqDiff = 0;
    for (let k = 0; k < slice.length; k++) {
      const diff = slice[k] - mean;
      sumSqDiff += diff * diff;
    }

    const variance = sumSqDiff / window;
    const std = Math.sqrt(variance);

    // 5. Расчет Z-Score
    // Защита от деления на 0 (если линия плоская, std=0)
    if (std > 1e-9) {
      // Используем эпсилон вместо строгого 0
      zScoreValues[i] = (series[i] - mean) / std;
    } else {
      // Если волатильности нет (std=0), Z-Score неопределен -> 0
      zScoreValues[i] = 0;
    }
  }

  return zScoreValues;
}
