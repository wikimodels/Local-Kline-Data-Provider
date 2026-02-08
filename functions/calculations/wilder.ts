import { calculateSMA } from './ma.ts';

export function wilderSmooth(series: number[], length: number): number[] {
  const smoothed: number[] = new Array(series.length).fill(NaN);
  if (series.length < length) return smoothed;

  const sma = calculateSMA(series, length);
  smoothed[length - 1] = sma[length - 1];

  for (let i = length; i < series.length; i++) {
    smoothed[i] = (smoothed[i - 1] * (length - 1) + series[i]) / length;
  }

  return smoothed;
}
