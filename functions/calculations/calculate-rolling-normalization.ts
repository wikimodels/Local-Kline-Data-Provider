export function calculateRollingNormalization(series: number[], window: number): number[] {
  const result = new Array(series.length).fill(0);

  for (let i = 0; i < series.length; i++) {
    // Если истории не хватает - оставляем 0
    if (i < window - 1) continue;

    let min = Infinity;
    let max = -Infinity;
    let hasNaN = false;

    // Пробегаем по окну
    for (let j = 0; j < window; j++) {
      const val = series[i - j];
      if (val === undefined || val === null || Number.isNaN(val)) {
        hasNaN = true;
        break;
      }
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (hasNaN || min === Infinity || max === -Infinity) {
      result[i] = 0;
      continue;
    }

    const range = max - min;
    const current = series[i];

    if (range === 0) {
      // Если линия плоская (max === min), нормализация неопределена.
      // Возвращаем 0 (или 0.5, но 0 безопаснее для графиков типа "осциллятор")
      result[i] = 0;
    } else {
      // Формула Min-Max
      result[i] = (current - min) / range;
    }
  }

  return result;
}
