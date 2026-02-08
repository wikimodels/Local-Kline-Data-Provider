// projects/data-core/src/lib/calculations/ma.ts (ИСПРАВЛЕН)

/**
 * Рассчитывает простое скользящее среднее (SMA).
 */
export function calculateSMA(series: number[], length: number): number[] {
  const sma: number[] = new Array(series.length).fill(NaN);

  for (let i = length - 1; i < series.length; i++) {
    const slice = series.slice(i - length + 1, i + 1);

    // --- ИСПРАВЛЕНИЕ: Проверяем, есть ли NaN в "окне" ---
    if (slice.some((v) => Number.isNaN(v))) {
      sma[i] = NaN;
      continue;
    }
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

    const sum = slice.reduce((a, b) => a + b, 0);
    sma[i] = sum / length;
  }
  return sma;
}

/**
 * Рассчитывает экспоненциальное скользящее среднее (EMA).
 */
export function calculateEMA(series: number[], length: number): number[] {
  const ema: number[] = new Array(series.length).fill(NaN);
  if (series.length < length) return ema;

  const k = 2 / (length + 1);
  const sma = calculateSMA(series, length);

  // --- ИСПРАВЛЕНИЕ: Находим первый валидный SMA для "зерна" ---
  let seedIndex = -1;
  for (let i = length - 1; i < sma.length; i++) {
    if (!Number.isNaN(sma[i])) {
      ema[i] = sma[i]; // Это наше первое валидное EMA "зерно"
      seedIndex = i;
      break;
    }
  }

  // Если "зерно" не найдено (нет данных)
  if (seedIndex === -1) {
    return ema;
  }

  // 2. Итеративный расчет: EMA[i] = (Price[i] * k) + (EMA[i-1] * (1 - k))
  for (let i = seedIndex + 1; i < series.length; i++) {
    // Если в исходных данных "дырка" (NaN), мы не можем рассчитать
    if (Number.isNaN(series[i])) {
      ema[i] = NaN; // (Или ema[i-1], если нужно нести значение дальше)
    } else {
      // Если предыдущее значение EMA - NaN (из-за "дырки"), мы не можем продолжать
      if (Number.isNaN(ema[i - 1])) {
        ema[i] = NaN;
      } else {
        ema[i] = series[i] * k + ema[i - 1] * (1 - k);
      }
    }
  }
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
  return ema;
}
