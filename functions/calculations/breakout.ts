import { PriceSeries } from "../../models/types.ts";

/**
 * Определяет "Пробитие" (Breakout) вверх и "Пробой" (Breakdown) вниз.
 * Сравнивает текущее Закрытие (close[i]) с *предыдущим* уровнем (level[i-1]).
 *
 * @param closePrices Массив цен Закрытия.
 * @param highestHighSeries Массив 'Highest High' (н-р, highest_50).
 * @param lowestLowSeries Массив 'Lowest Low' (н-р, lowest_50).
 * @param period Период (н-р, 50) для именования ключей.
 * @returns Объект с 2 массивами: isCrossedUpHighest[Period] и isCrossedDownLowest[Period] (boolean[]).
 */
export function analyzeBreakouts(
  closePrices: number[],
  highestHighSeries: number[],
  lowestLowSeries: number[],
  period: number,
): { [key: string]: boolean[] } {
  const arrayLength = closePrices.length;
  const isCrossedUp: boolean[] = new Array(arrayLength).fill(false);
  const isCrossedDown: boolean[] = new Array(arrayLength).fill(false);

  for (let i = 1; i < arrayLength; i++) {
    const close = closePrices[i];
    const prevClose = closePrices[i - 1];

    // --- КЛЮЧЕВАЯ ЛОГИКА ---
    // Мы сравниваем с УРОВНЕМ НА ПРЕДЫДУЩЕЙ СВЕЧЕ (i-1)
    const prevHigh = highestHighSeries[i - 1];
    const prevLow = lowestLowSeries[i - 1];
    // ---

    // 1. Пробитие Вверх (Bullish Breakout)
    if (
      !Number.isNaN(prevHigh) &&
      prevClose <= prevHigh && // Предыдущая свеча была ПОД или НА уровне
      close > prevHigh // Текущая свеча ЗАКРЫЛАСЬ НАД уровнем
    ) {
      isCrossedUp[i] = true;
    }

    // 2. Пробой Вниз (Bearish Breakdown)
    if (
      !Number.isNaN(prevLow) &&
      prevClose >= prevLow && // Предыдущая свеча была НАД или НА уровне
      close < prevLow // Текущая свеча ЗАКРЫЛАСЬ ПОД уровнем
    ) {
      isCrossedDown[i] = true;
    }
  }

  return {
    [`isCrossedUpHighest${period}`]: isCrossedUp,
    [`isCrossedDownLowest${period}`]: isCrossedDown,
  };
}
