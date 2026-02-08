// projects/data-core/src/lib/calculations/avwap.ts

import { PriceSeries } from "../../models/types.ts";

/**
 * Определяет, является ли текущая свеча началом нового периода (недели или месяца).
 * @param openTime Время открытия свечи в миллисекундах.
 * @param anchor Период привязки ('W' или 'M').
 * @param prevTime Предыдущее время открытия в миллисекундах.
 */
function isNewAnchorPeriod(
  openTime: number,
  anchor: string,
  prevTime: number,
): boolean {
  const date = new Date(openTime);
  const prevDate = new Date(prevTime);

  if (anchor === "W") {
    const isNewWeek = date.getDay() === 1 && prevDate.getDay() !== 1;

    const dayOfMonth = date.getDate();
    const prevDayOfMonth = prevDate.getDate();

    if (dayOfMonth < prevDayOfMonth) {
      const weekOfYear = Math.floor(
        (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
      const prevWeekOfYear = Math.floor(
        (prevDate.getTime() -
          new Date(prevDate.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );

      return weekOfYear !== prevWeekOfYear;
    }

    return isNewWeek;
  } else if (anchor === "M") {
    return date.getMonth() !== prevDate.getMonth();
  }
  return false;
}

/**
 * Рассчитывает Anchored VWAP (AVWAP).
 * @param series Серии цен (PriceSeries).
 * @param anchor Период привязки ('W' для недели, 'M' для месяца).
 * @param stdevMult Множитель стандартного отклонения (стандартно 1.0).
 */
export function calculateAnchoredVWAP(
  series: PriceSeries,
  anchor: "W" | "M",
  stdevMult: number = 1.0,
) {
  const arrayLength = series.closePrice.length;
  const prefix = anchor === "W" ? "w" : "m";

  const vwapValues: number[] = new Array(arrayLength).fill(NaN);
  const upperBand: number[] = new Array(arrayLength).fill(NaN);
  const lowerBand: number[] = new Array(arrayLength).fill(NaN);

  if (arrayLength === 0) {
    // ✅ camelCase: wAvwap, wAvwapUpperBand, wAvwapLowerBand
    return {
      [`${prefix}Avwap`]: vwapValues,
      [`${prefix}AvwapUpperBand`]: upperBand,
      [`${prefix}AvwapLowerBand`]: lowerBand,
    };
  }

  let cumSrcVol = 0;
  let cumVol = 0;
  let cumSrcSrcVol = 0;
  let prevOpenTime = series.openTime[0];

  for (let i = 0; i < arrayLength; i++) {
    const high = series.highPrice[i];
    const low = series.lowPrice[i];
    const close = series.closePrice[i];
    const volume = series.volume[i];
    const openTime = series.openTime[i];

    if (i > 0 && isNewAnchorPeriod(openTime, anchor, prevOpenTime)) {
      cumSrcVol = 0;
      cumVol = 0;
      cumSrcSrcVol = 0;
    }

    prevOpenTime = openTime;

    const src = (high + low + close) / 3;

    cumSrcVol += src * volume;
    cumVol += volume;
    cumSrcSrcVol += src ** 2 * volume;

    if (cumVol > 0) {
      const vwap = cumSrcVol / cumVol;
      vwapValues[i] = vwap;

      let variance = cumSrcSrcVol / cumVol - vwap ** 2;
      variance = Math.max(0, variance);
      const stdev = Math.sqrt(variance);

      upperBand[i] = vwap + stdev * stdevMult;
      lowerBand[i] = vwap - stdev * stdevMult;
    } else {
      vwapValues[i] = NaN;
      upperBand[i] = NaN;
      lowerBand[i] = NaN;
    }
  }

  // ✅ camelCase в финальном результате
  return {
    [`${prefix}Avwap`]: vwapValues,
    [`${prefix}AvwapUpperBand`]: upperBand,
    [`${prefix}AvwapLowerBand`]: lowerBand,
  };
}
