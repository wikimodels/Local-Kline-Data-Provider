import { PriceSeries } from "../../models/types.ts";
import { calculateEMA } from "./ma.ts"; // <-- ИМПОРТИРУЕМ EMA

/**
 * Рассчитывает On Balance Volume (OBV) и его EMA(20).
 * @param series Объект числовых серий.
 */
export function calculateOBV(series: PriceSeries) {
  const closePrices = series.closePrice;
  const volumes = series.volume;
  const arrayLength = closePrices.length;

  const obvValues: number[] = new Array(arrayLength).fill(0);

  if (arrayLength === 0) {
    return { obv: [], obv_ema_20: [] }; // <-- Возвращаем оба
  }

  // Инициализация: Первое значение OBV равно объему первой свечи.
  // Если volume[0] не является числом, начинаем с 0.
  obvValues[0] = volumes[0];

  // Итеративный расчет: начиная со второй свечи
  for (let i = 1; i < arrayLength; i++) {
    const currentClose = closePrices[i];
    const prevClose = closePrices[i - 1];
    const currentVolume = volumes[i];
    const prevOBV = obvValues[i - 1];

    if (currentClose > prevClose) {
      // Цена закрылась выше: Volume прибавляется к предыдущему OBV
      obvValues[i] = prevOBV + currentVolume;
    } else if (currentClose < prevClose) {
      // Цена закрылась ниже: Volume вычитается из предыдущего OBV
      obvValues[i] = prevOBV - currentVolume;
    } else {
      // Цена закрытия не изменилась: OBV остается прежним
      obvValues[i] = prevOBV;
    }

    // Обработка NaN: Если предыдущий OBV или текущий Volume был NaN, текущий OBV тоже должен быть NaN
    if (Number.isNaN(prevOBV) || Number.isNaN(currentVolume)) {
      obvValues[i] = NaN;
    }
  }

  // --- НОВОЕ: Расчет EMA(20) от OBV ---
  const obvEma20 = calculateEMA(obvValues, 20);

  return {
    obv: obvValues,
    obv_ema_20: obvEma20, // <-- Возвращаем EMA
  };
}
