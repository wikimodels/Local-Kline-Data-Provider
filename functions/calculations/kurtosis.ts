import { PriceSeries } from "../../models/types.ts";
import { getLogReturns } from "./math-utils.ts";

export function calculateRollingKurtosis(
  series: PriceSeries,
  window: number = 100,
): number[] {
  // 1. Используем Log Returns!
  const data = getLogReturns(series.closePrice);
  const length = data.length; // Это на 1 меньше, чем series.length

  // Результирующий массив выравниваем по длине свечей
  const result: number[] = new Array(series.closePrice.length).fill(NaN);

  if (length < window) return result;

  for (let i = window - 1; i < length; i++) {
    const slice = data.slice(i - window + 1, i + 1);

    const n = slice.length;
    const sum = slice.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    let sumSqDiff = 0;
    let sumFourthPowerDiff = 0;

    for (const val of slice) {
      const diff = val - mean;
      sumSqDiff += diff * diff;
      sumFourthPowerDiff += Math.pow(diff, 4);
    }

    const variance = sumSqDiff / (n - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      result[i + 1] = 0; // i+1 из-за сдвига returns
      continue;
    }

    const fourthMoment = sumFourthPowerDiff / Math.pow(stdDev, 4);

    // Формула избыточного эксцесса (Unbiased)
    const c1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const c2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    const excessKurtosis = c1 * fourthMoment - c2;

    result[i + 1] = excessKurtosis;
  }

  return result;
}
