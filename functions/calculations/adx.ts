import { PriceSeries } from "../../models/types.ts";
import { calculateTrueRange } from "./atr.ts";
import { wilderSmooth } from "./wilder.ts";

export function calculateDirectionalMovement(series: PriceSeries): {
  plusDM: number[];
  minusDM: number[];
} {
  const arrayLength = series.closePrice.length;
  const plusDM: number[] = new Array(arrayLength).fill(0);
  const minusDM: number[] = new Array(arrayLength).fill(0);

  for (let i = 1; i < arrayLength; i++) {
    const moveUp = series.highPrice[i] - series.highPrice[i - 1];
    const moveDown = series.lowPrice[i - 1] - series.lowPrice[i];

    if (moveUp > moveDown && moveUp > 0) {
      plusDM[i] = moveUp;
    } else {
      plusDM[i] = 0;
    }

    if (moveDown > moveUp && moveDown > 0) {
      minusDM[i] = moveDown;
    } else {
      minusDM[i] = 0;
    }
  }

  return { plusDM, minusDM };
}

export function calculateADX(series: PriceSeries, length: number = 14) {
  const arrayLength = series.closePrice.length;
  if (arrayLength <= length) {
    return {
      adx: new Array(arrayLength).fill(NaN),
      di_plus: new Array(arrayLength).fill(NaN),
      di_minus: new Array(arrayLength).fill(NaN),
    };
  }

  const tr = calculateTrueRange(series);
  const { plusDM, minusDM } = calculateDirectionalMovement(series);

  const atr = wilderSmooth(tr, length);
  const plusDMSmooth = wilderSmooth(plusDM, length);
  const minusDMSmooth = wilderSmooth(minusDM, length);

  const diPlus: number[] = new Array(arrayLength).fill(NaN);
  const diMinus: number[] = new Array(arrayLength).fill(NaN);

  for (let i = length; i < arrayLength; i++) {
    const atrVal = atr[i];
    if (atrVal && atrVal > 0) {
      diPlus[i] = (100 * plusDMSmooth[i]) / atrVal;
      diMinus[i] = (100 * minusDMSmooth[i]) / atrVal;
    }
  }

  const dx: number[] = new Array(arrayLength).fill(NaN);
  for (let i = length; i < arrayLength; i++) {
    const sum = diPlus[i] + diMinus[i];
    if (sum > 0) {
      dx[i] = (100 * Math.abs(diPlus[i] - diMinus[i])) / sum;
    }
  }

  const adx: number[] = new Array(arrayLength).fill(NaN);
  const firstAdxIndex = 2 * length - 1; // 14 + 14 - 1 = 27

  if (arrayLength > firstAdxIndex) {
    let sum = 0;
    for (let i = length; i <= firstAdxIndex; i++) {
      sum += dx[i];
    }
    adx[firstAdxIndex] = sum / length;

    for (let i = firstAdxIndex + 1; i < arrayLength; i++) {
      adx[i] = (adx[i - 1] * (length - 1) + dx[i]) / length;
    }
  }

  return {
    adx,
    di_plus: diPlus,
    di_minus: diMinus,
  };
}
