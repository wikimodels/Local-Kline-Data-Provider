// projects/data-core/src/lib/calculations/patterns.ts

import { PriceSeries } from "../../models/types.ts";

export interface CandlePatternResults {
  isDoji: boolean[];
  isBullishEngulfing: boolean[];
  isBearishEngulfing: boolean[];
  isHammer: boolean[];
  isPinbar: boolean[];
}

/**
 * Распознает базовые свечные паттерны Price Action, используя только соотношения цены.
 * @param series Объект числовых серий.
 */
export function recognizeCandlePatterns(
  series: PriceSeries,
): CandlePatternResults {
  const arrayLength = series.closePrice.length;
  const {
    openPrice,
    highPrice: high,
    lowPrice: low,
    closePrice: close,
  } = series;

  if (arrayLength < 2) {
    return {
      isDoji: [],
      isBullishEngulfing: [],
      isBearishEngulfing: [],
      isHammer: [],
      isPinbar: [],
    };
  }

  // --- Вспомогательные расчеты ---
  const bodyAbs: number[] = new Array(arrayLength).fill(NaN);
  const range: number[] = new Array(arrayLength).fill(NaN);
  const upperShadow: number[] = new Array(arrayLength).fill(NaN);
  const lowerShadow: number[] = new Array(arrayLength).fill(NaN);

  for (let i = 0; i < arrayLength; i++) {
    bodyAbs[i] = Math.abs(close[i] - openPrice[i]);
    range[i] = high[i] - low[i];

    const bodyMax = Math.max(openPrice[i], close[i]);
    const bodyMin = Math.min(openPrice[i], close[i]);

    upperShadow[i] = high[i] - bodyMax;
    lowerShadow[i] = bodyMin - low[i];
  }

  // --- Инициализация результатов ---
  const isDoji: boolean[] = new Array(arrayLength).fill(false);
  const isBullishEngulfing: boolean[] = new Array(arrayLength).fill(false);
  const isBearishEngulfing: boolean[] = new Array(arrayLength).fill(false);
  const isHammer: boolean[] = new Array(arrayLength).fill(false);
  const isPinbar: boolean[] = new Array(arrayLength).fill(false);

  // --- Распознавание паттернов ---
  for (let i = 1; i < arrayLength; i++) {
    // 1. Doji
    if (bodyAbs[i] < range[i] * 0.1 && range[i] > 0) {
      isDoji[i] = true;
    }

    // Паттерны поглощения
    const prevIsRed = openPrice[i - 1] > close[i - 1];
    const currIsGreen = close[i] > openPrice[i];
    const prevIsGreen = close[i - 1] > openPrice[i - 1];
    const currIsRed = openPrice[i] > close[i];

    // 2. Bullish Engulfing
    if (
      prevIsRed &&
      currIsGreen &&
      close[i] > openPrice[i - 1] &&
      openPrice[i] < close[i - 1]
    ) {
      isBullishEngulfing[i] = true;
    }

    // 3. Bearish Engulfing
    if (
      prevIsGreen &&
      currIsRed &&
      openPrice[i] > close[i - 1] &&
      close[i] < openPrice[i - 1]
    ) {
      isBearishEngulfing[i] = true;
    }

    // 4. Hammer
    if (lowerShadow[i] > bodyAbs[i] * 2 && upperShadow[i] < bodyAbs[i]) {
      isHammer[i] = true;
    }

    // 5. Pin Bar (Shooting Star)
    if (upperShadow[i] > bodyAbs[i] * 2 && lowerShadow[i] < bodyAbs[i]) {
      isPinbar[i] = true;
    }
  }

  return {
    isDoji,
    isBullishEngulfing,
    isBearishEngulfing,
    isHammer,
    isPinbar,
  };
}
