// projects/data-core/src/lib/calculations/states.ts

import { PriceSeries } from "../../models/types.ts";

/**
 * Определяет четыре состояния цены (Cross Up/Down, Above/Below) относительно одной линии.
 * @param series Объект PriceSeries для доступа к ценам закрытия и открытия.
 * @param lineValues Значения линии (EMA, KAMA, VWAP) для сравнения.
 * @param lineName Имя линии (например, 'Ema50', 'Kama') для формирования ключей результата.
 */
export function analyzeLineStates(
  series: PriceSeries,
  lineValues: number[],
  lineName: string,
): { [key: string]: boolean[] } {
  const arrayLength = series.closePrice.length;

  const isCrossedUp: boolean[] = new Array(arrayLength).fill(false);
  const isCrossedDown: boolean[] = new Array(arrayLength).fill(false);
  const isAbove: boolean[] = new Array(arrayLength).fill(false);
  const isBelow: boolean[] = new Array(arrayLength).fill(false);

  for (let i = 1; i < arrayLength; i++) {
    const close = series.closePrice[i];
    const open = series.openPrice[i];
    const prevClose = series.closePrice[i - 1];

    const line = lineValues[i];
    const prevLine = lineValues[i - 1];

    if (Number.isNaN(line) || Number.isNaN(prevLine)) continue;

    // --- 1. Пересечения (Crosses) ---
    if (prevClose < prevLine && close > line) {
      isCrossedUp[i] = true;
    }

    if (prevClose > prevLine && close < line) {
      isCrossedDown[i] = true;
    }

    // --- 2. Позиция (Above/Below) ---
    if (close > line && open > line) {
      isAbove[i] = true;
    }

    if (close < line && open < line) {
      isBelow[i] = true;
    }
  }

  return {
    [`isCrossedUp${lineName}`]: isCrossedUp,
    [`isCrossedDown${lineName}`]: isCrossedDown,
    [`isAbove${lineName}`]: isAbove,
    [`isBelow${lineName}`]: isBelow,
  };
}
