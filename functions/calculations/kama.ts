// projects/data-core/src/lib/calculations/kama.ts

import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает Адаптивную Скользящую Среднюю Кауфмана (KAMA).
 */
export function calculateKAMA(
  series: PriceSeries,
  length: number = 10, // Период для ER (momentum/volatility)
  fastLength: number = 2, // Период быстрой EMA
  slowLength: number = 30, // Период медленной EMA
) {
  const closePrices = series.closePrice;
  const arrayLength = closePrices.length;

  // Результаты, заполненные NaN
  const kamaValues: number[] = new Array(arrayLength).fill(NaN);
  const smoothingConstant: number[] = new Array(arrayLength).fill(NaN);

  if (arrayLength < length) {
    return { kama: kamaValues };
  }

  // Рассчитываем сглаживающие константы для крайних EMA
  const fastAlpha = 2 / (fastLength + 1);
  const slowAlpha = 2 / (slowLength + 1);

  // --- 1. Расчет ER (Efficiency Ratio) и SC (Smoothing Constant) ---

  // ER = Direction / Volatility
  for (let i = length - 1; i < arrayLength; i++) {
    // Направление (Direction/Momentum): |Close[i] - Close[i - length]|
    const direction = Math.abs(closePrices[i] - closePrices[i - length]);

    // Волатильность (Volatility): Сумма |Close[k] - Close[k-1]| за период 'length'
    let volatility = 0;
    for (let j = i - length + 1; j <= i; j++) {
      // Разница Close[j] - Close[j-1]
      if (j > 0) {
        volatility += Math.abs(closePrices[j] - closePrices[j - 1]);
      }
    }

    let er = 0;
    if (volatility !== 0) {
      er = direction / volatility;
    }

    // SC (Smoothing Constant) = [ER * (Alpha_Fast - Alpha_Slow) + Alpha_Slow]^2
    const sc = Math.pow(er * (fastAlpha - slowAlpha) + slowAlpha, 2);
    smoothingConstant[i] = sc;
  }

  // --- 2. Итеративный расчет KAMA ---

  // Первое значение KAMA (инициализация)
  // Используем первое доступное значение Close (когда ER впервые рассчитан)
  kamaValues[length - 1] = closePrices[length - 1];

  for (let i = length; i < arrayLength; i++) {
    const sc = smoothingConstant[i];

    if (!Number.isNaN(sc) && !Number.isNaN(kamaValues[i - 1])) {
      // KAMA[i] = KAMA[i-1] + SC * (Close[i] - KAMA[i-1])
      kamaValues[i] =
        kamaValues[i - 1] + sc * (closePrices[i] - kamaValues[i - 1]);
    } else {
      // Если SC еще не рассчитан (в начале ряда), используем предыдущее значение или NaN
      kamaValues[i] = kamaValues[i - 1];
    }
  }

  // Возвращаем только KAMA, хотя SC также может быть полезен
  return { kama: kamaValues };
}
