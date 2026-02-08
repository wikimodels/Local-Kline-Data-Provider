// Используем ранее созданную функцию Уайлдера

import { PriceSeries } from "../../models/types.ts";
import { wilderSmooth } from "./wilder.ts";

/**
 * Рассчитывает Relative Strength Index (RSI).
 * Логика полностью соответствует rsi.py и стандарту TradingView (RMA smoothing).
 */
export function calculateRSI(series: PriceSeries, length: number = 14) {
  const closePrices = series.closePrice;
  const arrayLength = closePrices.length;

  if (arrayLength < length) {
    return { rsi: new Array(arrayLength).fill(NaN) };
  }

  const delta: number[] = new Array(arrayLength).fill(NaN);
  const gain: number[] = new Array(arrayLength).fill(0);
  const loss: number[] = new Array(arrayLength).fill(0);

  // 1. Рассчитываем дельту и разделяем на выигрыш (gain) и проигрыш (loss)
  for (let i = 1; i < arrayLength; i++) {
    delta[i] = closePrices[i] - closePrices[i - 1];

    if (delta[i] > 0) {
      gain[i] = delta[i];
    } else if (delta[i] < 0) {
      // В TradingView потери всегда положительны
      loss[i] = Math.abs(delta[i]);
    }
  }

  // 2. Сглаживаем выигрыш и проигрыш с помощью Уайлдера (RMA)
  // RMA - это ключ к расчету RSI
  const avgGain = wilderSmooth(gain, length);
  const avgLoss = wilderSmooth(loss, length);

  const rsi: number[] = new Array(arrayLength).fill(NaN);

  // 3. Рассчитываем RS и RSI
  for (let i = length; i < arrayLength; i++) {
    // Предотвращаем деление на ноль: если AvgLoss == 0, RSI = 100
    if (avgLoss[i] === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain[i] / avgLoss[i];
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return { rsi: rsi };
}
