import { PriceSeries } from "../../models/types.ts";
import { calculateEMA } from "./ma.ts";

/**
 * Рассчитывает Volume Zone Oscillator (VZO).
 * FIX: Возвращает NaN, если данных недостаточно или EMA еще не разогрелась.
 */
export function calculateVZO(series: PriceSeries, length: number = 14) {
  const arrayLength = series.closePrice.length;

  // 1. Расчет Net Volume (R)
  const nv = calculateNetVolume(series);

  // 2. Raw Volume
  const volumes = series.volume;

  // 3. Сглаживание (EMA)
  const vne = calculateEMA(nv, length); // Net Volume EMA
  const vce = calculateEMA(volumes, length); // Total Volume EMA

  const vzoValues: number[] = new Array(arrayLength).fill(NaN);

  for (let i = 0; i < arrayLength; i++) {
    const vceVal = vce[i];
    const vneVal = vne[i];

    // ЗОЛОТОЕ ПРАВИЛО: Если EMA не посчиталась (NaN) — результат NaN.
    if (
      vceVal !== undefined &&
      vceVal !== null &&
      !Number.isNaN(vceVal) &&
      !Number.isNaN(vneVal)
    ) {
      // Защита от деления на ноль
      if (vceVal !== 0) {
        vzoValues[i] = 100 * (vneVal / vceVal);
      } else {
        // Если общий объем 0, то и движения нет. Тут 0 допустим.
        vzoValues[i] = 0;
      }
    } else {
      // Данные не готовы (Warmup period)
      vzoValues[i] = NaN;
    }
  }

  return { vzo: vzoValues };
}

export function calculateNetVolume(series: PriceSeries): number[] {
  const closePrices = series.closePrice;
  const volumes = series.volume;
  const arrayLength = closePrices.length;

  const nvValues: number[] = new Array(arrayLength).fill(0);

  // i=0 пропускаем (нет предыдущего закрытия)
  for (let i = 1; i < arrayLength; i++) {
    const close = closePrices[i];
    const prevClose = closePrices[i - 1];
    const volume = volumes[i];

    if (close > prevClose) {
      nvValues[i] = volume;
    } else if (close < prevClose) {
      nvValues[i] = -volume;
    } else {
      nvValues[i] = 0;
    }
  }
  return nvValues;
}
