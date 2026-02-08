// projects/data-core/src/lib/data-core/calculations/macd.ts (ИСПРАВЛЕН)

import { PriceSeries } from "../../models/types.ts";
import { calculateEMA } from "./ma.ts";

// Предполагаем, что calculateEMA находится в './ma'

export function calculateMACD(
  series: PriceSeries,
  fast: number = 12,
  slow: number = 26,
  signal: number = 9,
) {
  const closePrices = series.closePrice;
  if (closePrices.length < slow) {
    return { macd: [], macd_signal: [], macd_histogram: [] };
  }

  const emaFast = calculateEMA(closePrices, fast);
  const emaSlow = calculateEMA(closePrices, slow);

  // 1. MACD Line = EMA_Fast - EMA_Slow
  const macdLine = closePrices.map((_, i) =>
    // ИСПРАВЛЕНИЕ: Используем !Number.isNaN() для корректной проверки
    !Number.isNaN(emaFast[i]) && !Number.isNaN(emaSlow[i])
      ? emaFast[i] - emaSlow[i]
      : NaN,
  );

  // 2. Signal Line = EMA of MACD Line
  const signalLine = calculateEMA(macdLine, signal);

  // 3. Histogram = MACD Line - Signal Line
  const histogram = macdLine.map((macd, i) =>
    // ИСПРАВЛЕНИЕ: Используем !Number.isNaN() для корректной проверки
    !Number.isNaN(macd) && !Number.isNaN(signalLine[i])
      ? macd - signalLine[i]
      : NaN,
  );

  return {
    macd: macdLine,
    macd_signal: signalLine,
    macd_histogram: histogram,
  };
}
