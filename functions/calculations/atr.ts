import { PriceSeries } from "../../models/types.ts";
import { wilderSmooth } from "./wilder.ts";

export function calculateTrueRange(series: PriceSeries): number[] {
  const length = series.closePrice.length;
  const tr: number[] = new Array(length).fill(NaN);

  if (length === 0) return tr;

  tr[0] = series.highPrice[0] - series.lowPrice[0];

  for (let i = 1; i < length; i++) {
    const high = series.highPrice[i];
    const low = series.lowPrice[i];
    const prevClose = series.closePrice[i - 1];
    tr[i] = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );
  }
  return tr;
}

export function calculateATR(series: PriceSeries, length: number = 14) {
  const trValues = calculateTrueRange(series);
  const atrValues = wilderSmooth(trValues, length);
  return { atr: atrValues };
}
