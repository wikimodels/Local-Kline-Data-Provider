import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает состояния "Веера EMA" (EMA Fan), "Панчи" (Punches) и "Беспорядочного Веера" (Mess Fan).
 *
 * @param ema50Series Массив значений EMA(50).
 * @param ema100Series Массив значений EMA(100).
 * @param ema150Series Массив значений EMA(150).
 * @param highPrices Массив High цен (для "Панчей").
 * @param lowPrices Массив Low цен (для "Панчей").
 * @returns Объект с 5 массивами: ...Fan и ...Punch (boolean[]).
 */
export function calculateEmaFan(
  ema50Series: number[],
  ema100Series: number[],
  ema150Series: number[],
  highPrices: number[],
  lowPrices: number[],
) {
  const arrayLength = ema50Series.length;
  const isBullishFan: boolean[] = new Array(arrayLength).fill(false);
  const isBearishFan: boolean[] = new Array(arrayLength).fill(false);
  const isMessFan: boolean[] = new Array(arrayLength).fill(false);
  const isBullishPunch: boolean[] = new Array(arrayLength).fill(false);
  const isBearishPunch: boolean[] = new Array(arrayLength).fill(false);

  for (let i = 0; i < arrayLength; i++) {
    const ema50 = ema50Series[i];
    const ema100 = ema100Series[i];
    const ema150 = ema150Series[i];
    const high = highPrices[i];
    const low = lowPrices[i];

    if (
      Number.isNaN(ema50) ||
      Number.isNaN(ema100) ||
      Number.isNaN(ema150) ||
      Number.isNaN(high) ||
      Number.isNaN(low)
    ) {
      continue;
    }

    const bullishFan = ema50 > ema100 && ema100 > ema150;
    const bearishFan = ema50 < ema100 && ema100 < ema150;

    isBullishFan[i] = bullishFan;
    isBearishFan[i] = bearishFan;
    isMessFan[i] = !bullishFan && !bearishFan;

    isBullishPunch[i] = bullishFan && low < ema150; // Пробой ВНИЗ через нижнюю EMA в бычьем веере
    isBearishPunch[i] = bearishFan && high > ema50; // Пробой ВВЕРХ через верхнюю EMA в медвежьем веере
  }

  return {
    isBullishFan,
    isBearishFan,
    isMessFan,
    isBullishPunch,
    isBearishPunch,
  };
}
