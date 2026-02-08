import { PriceSeries } from "../../models/types.ts";
import { calculateEMA } from "./ma.ts";

/**
 * Рассчитывает Chaikin Volatility (CHV).
 * @param series Объект числовых серий.
 * @param length Период для расчета EMA от диапазона (стандартно 10).
 * @param period Период, с которым сравнивается текущая EMA (стандартно 10).
 */
export function calculateCHV(
  series: PriceSeries,
  length: number = 10,
  period: number = 10,
) {
  const arrayLength = series.closePrice.length;

  // 1. Рассчитываем True Range (High - Low)
  const priceRange: number[] = new Array(arrayLength).fill(NaN);
  for (let i = 0; i < arrayLength; i++) {
    priceRange[i] = series.highPrice[i] - series.lowPrice[i];
  }

  // 2. Рассчитываем EMA от Range (Volatility Index - VI)
  const volatilityIndex = calculateEMA(priceRange, length);

  const chvValues: number[] = new Array(arrayLength).fill(NaN);

  // 3. Расчет CHV
  // CHV[i] = 100 * (VI[i] - VI[i - period]) / VI[i - period]
  for (let i = length + period; i < arrayLength; i++) {
    const currentVI = volatilityIndex[i];
    const prevVI = volatilityIndex[i - period];

    if (!Number.isNaN(currentVI) && !Number.isNaN(prevVI) && prevVI !== 0) {
      chvValues[i] = (100 * (currentVI - prevVI)) / prevVI;
    } else {
      chvValues[i] = NaN;
    }
  }

  return { chv: chvValues };
}
