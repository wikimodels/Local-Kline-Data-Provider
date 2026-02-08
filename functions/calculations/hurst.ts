import { PriceSeries } from "../../models/types.ts";
import { getLogReturns } from "./math-utils.ts"; // Импортируй утилиту

export interface HurstResult {
  value: number; // Сам показатель Херста
  confidence: number; // R-squared (0...1). Чем ближе к 1, тем надежнее.
}

export function calculateRollingHurst(
  series: PriceSeries,
  window: number = 400,
): HurstResult[] {
  // 1. Сразу переводим ВСЕ цены в Log Returns
  const returns = getLogReturns(series.closePrice);
  const length = returns.length;

  // Результат будет сдвинут на 1 индекс относительно цен (т.к. returns короче)
  // Заполним пустышками, чтобы длина совпадала с candles
  const result: HurstResult[] = new Array(series.closePrice.length).fill({
    value: NaN,
    confidence: NaN,
  });

  if (length < window) return result;

  // Бежим по массиву Returns
  for (let i = window - 1; i < length; i++) {
    const slice = returns.slice(i - window + 1, i + 1);

    // Результат пишем в i + 1, т.к. returns[i] соответствует свече i+1
    result[i + 1] = computeHurstOnSlice(slice);
  }

  return result;
}

function computeHurstOnSlice(returns: number[]): HurstResult {
  const n = returns.length;

  // Лаги: 2, 4, 8...
  const maxLag = Math.floor(n / 4);
  const lags: number[] = [];
  for (let lag = 2; lag <= maxLag; lag *= 2) lags.push(lag);

  if (lags.length < 2) return { value: NaN, confidence: NaN };

  const x_log_lags: number[] = [];
  const y_log_std: number[] = [];

  for (const lag of lags) {
    // Агрегированная волатильность (Aggregated Volatility)
    // Разбиваем срез на блоки длиной 'lag' и считаем stddev средних
    const numBlocks = Math.floor(n / lag);
    if (numBlocks < 2) continue;

    const blockAverages: number[] = [];
    for (let k = 0; k < numBlocks; k++) {
      let sum = 0;
      for (let j = 0; j < lag; j++) {
        sum += returns[k * lag + j];
      }
      blockAverages.push(sum / lag); // Среднее в блоке
    }

    // Считаем StdDev этих средних
    const avgOfAverages = blockAverages.reduce((a, b) => a + b, 0) / numBlocks;
    const variance =
      blockAverages.reduce((a, b) => a + Math.pow(b - avgOfAverages, 2), 0) /
      (numBlocks - 1);

    if (variance > 0) {
      // Для Aggregated Variance Method наклон равен 2*H - 2 (или просто H-1 для волатильности)
      // Обычно используют график: log(std) ~ H * log(lag)
      // Но для доходностей наклон будет H - 1.
      // Поэтому H = Slope + 1 (для метода агрегированной дисперсии доходностей)
      // НО! Мы используем упрощенный R/S подход через волатильность сумм (V ~ T^H).
      // Если мы суммируем доходности (Cumulative sum), то SD(Sum) ~ lag^H.

      // Давай применим классический метод волатильности кумулятивной суммы:
      // SD(Change over lag) ~ lag^H

      // Пересчитаем дисперсию не средних, а СУММ (Total change over lag)
      const blockSums = blockAverages.map((avg) => avg * lag);
      const meanSum = blockSums.reduce((a, b) => a + b, 0) / numBlocks;
      const varSum =
        blockSums.reduce((a, b) => a + Math.pow(b - meanSum, 2), 0) /
        (numBlocks - 1);

      x_log_lags.push(Math.log(lag));
      y_log_std.push(Math.log(Math.sqrt(varSum)));
    }
  }

  if (x_log_lags.length < 3) return { value: NaN, confidence: NaN };

  // Линейная регрессия + R^2
  const nPoints = x_log_lags.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0,
    sumYY = 0;

  for (let k = 0; k < nPoints; k++) {
    const x = x_log_lags[k];
    const y = y_log_std[k];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }

  const denominator = nPoints * sumXX - sumX * sumX;
  if (denominator === 0) return { value: NaN, confidence: NaN };

  const slope = (nPoints * sumXY - sumX * sumY) / denominator; // Это и есть H
  const intercept = (sumY - slope * sumX) / nPoints;

  // Расчет R^2 (Confidence)
  // SS_tot (Total sum of squares)
  // SS_res (Residual sum of squares)
  const meanY = sumY / nPoints;
  let ssTot = 0;
  let ssRes = 0;

  for (let k = 0; k < nPoints; k++) {
    const y = y_log_std[k];
    const yPred = slope * x_log_lags[k] + intercept;
    ssTot += Math.pow(y - meanY, 2);
    ssRes += Math.pow(y - yPred, 2);
  }

  const rSquared = 1 - ssRes / ssTot;

  return {
    value: Math.min(Math.max(slope, 0), 1), // Clamp 0..1
    confidence: Math.max(0, rSquared), // R^2
  };
}
