// projects/data-core/src/lib/calculations/rolling-max-min.ts

import { PriceSeries } from "../../models/types.ts";

/**
 * Вспомогательная функция: Рассчитывает скользящий максимум или минимум за период.
 */
function rollingMaxMin(
  series: number[],
  period: number,
  operation: "max" | "min",
): number[] {
  const result: number[] = new Array(series.length).fill(NaN);

  if (series.length < period) return result;

  const opFunc = operation === "max" ? Math.max : Math.min;

  // Итерация начинается, когда окно заполнено
  for (let i = period - 1; i < series.length; i++) {
    // Извлекаем окно данных
    const window = series.slice(i - period + 1, i + 1);
    // Вычисляем максимум/минимум
    result[i] = opFunc(...window);
  }
  return result;
}

/**
 * Рассчитывает скользящий максимум (Highest High) для списка периодов.
 */
export function calculateHighestHigh(
  series: PriceSeries,
  periods: number[],
): { [key: string]: number[] } {
  const highPrices = series.highPrice;
  const results: { [key: string]: number[] } = {};

  for (const period of periods) {
    const values = rollingMaxMin(highPrices, period, "max");
    results[`highest${period}`] = values;
  }
  return results;
}

/**
 * Рассчитывает скользящий минимум (Lowest Low) для списка периодов.
 */
export function calculateLowestLow(
  series: PriceSeries,
  periods: number[],
): { [key: string]: number[] } {
  const lowPrices = series.lowPrice;
  const results: { [key: string]: number[] } = {};

  for (const period of periods) {
    const values = rollingMaxMin(lowPrices, period, "min");
    results[`lowest${period}`] = values;
  }
  return results;
}

/**
 * Рассчитывает Min-Max нормализацию [0...1] для Open, High, Low, Close.
 * Формула: (Price - Min) / (Max - Min)
 */
export function calculatePriceNormalization(
  series: PriceSeries,
  window: number = 50,
): {
  openPriceNorm: number[];
  highPriceNorm: number[];
  lowPriceNorm: number[];
  closePriceNorm: number[];
} {
  const len = series.closePrice.length;
  const result = {
    openPriceNorm: new Array(len).fill(NaN),
    highPriceNorm: new Array(len).fill(NaN),
    lowPriceNorm: new Array(len).fill(NaN),
    closePriceNorm: new Array(len).fill(NaN),
  };

  if (len < window) return result;

  // Вспомогательная лямбда для расчета одного массива
  const calcNorm = (data: number[]) => {
    const mins = rollingMaxMin(data, window, "min");
    const maxs = rollingMaxMin(data, window, "max");
    const norm = new Array(len).fill(NaN);

    for (let i = 0; i < len; i++) {
      const min = mins[i];
      const max = maxs[i];
      const val = data[i];

      if (!Number.isNaN(min) && !Number.isNaN(max) && !Number.isNaN(val)) {
        if (max === min) {
          norm[i] = 0; // Защита от деления на 0, если цена стояла на месте
        } else {
          norm[i] = (val - min) / (max - min);
        }
      }
    }
    return norm;
  };

  result.openPriceNorm = calcNorm(series.openPrice);
  result.highPriceNorm = calcNorm(series.highPrice);
  result.lowPriceNorm = calcNorm(series.lowPrice);
  result.closePriceNorm = calcNorm(series.closePrice);

  return result;
}
