import { PriceSeries } from "../../models/types.ts";

// Максимальные теоретические значения энтропии (H_max) для нормализации H/H_max
// H_max = log(N), где N — количество бинов.
const MAX_ENTROPY_20_BINS = Math.log(20);
const MAX_ENTROPY_3_BINS = Math.log(3);

// --- ФУНКЦИЯ 1: ЭНТРОПИЯ ВЕЛИЧИНЫ ДВИЖЕНИЯ (НОРМАЛИЗОВАНА [0, 1]) ---

/**
 * Рассчитывает Шенноновскую энтропию для последнего окна цен, используя ОТНОСИТЕЛЬНЫЕ ДОХОДНОСТИ.
 * Результат нормализован в диапазон [0, 1], где 1 — полный хаос (максимальная энтропия).
 *
 * @param series Объект PriceSeries с данными свечей.
 * @param windowLength Длина окна (количество свечей), для которых рассчитывается энтропия (по умолчанию 100).
 * @param bins Количество интервалов (корзин) для гистограммы (по умолчанию 20).
 * @returns Нормализованное значение энтропии в диапазоне [0, 1].
 */
export function calculateEntropy(
  series: PriceSeries,
  windowLength: number = 100,
  bins: number = 20,
): number {
  const closePrices = series.closePrice;
  const arrayLength = closePrices.length;

  // Для расчета N доходностей нужно N+1 свеча.
  if (arrayLength < windowLength + 1 || bins !== 20) {
    // Если количество бинов отличается от 20, для корректной нормализации
    // требуется пересчет MAX_ENTROPY, что выходит за рамки текущей задачи.
    // Возвращаем NaN, чтобы не использовать некорректно нормализованное значение.
    return NaN;
  }

  // 1. Берем окно цен
  const closeWindow = closePrices.slice(arrayLength - windowLength - 1);

  // 2. Рассчитываем относительные приращения (доходности)
  const returns: number[] = [];
  for (let i = 1; i < closeWindow.length; i++) {
    const prevClose = closeWindow[i - 1];
    const currentClose = closeWindow[i];

    if (prevClose === 0) {
      return NaN;
    }

    // Относительное изменение (Return)
    returns.push((currentClose - prevClose) / prevClose);
  }

  const values = returns;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const total = values.length;

  if (max === min) {
    return 0; // Полная предсказуемость, H = 0
  }

  // 3. Определяем размер шага и считаем частоты (counts)
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  values.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    counts[idx]++;
  });

  // 4. Нормализуем и вычисляем ненормализованную энтропию H
  const probs = counts.map((c) => c / total);
  let nonNormalizedEntropy = -probs
    .filter((p) => p > 0)
    .reduce((sum, p) => sum + p * Math.log(p), 0);

  // 5. ✅ ИЗМЕНЕНИЕ №1: Нормализация в диапазон [0, 1]
  return nonNormalizedEntropy / MAX_ENTROPY_20_BINS;
}

// --- ФУНКЦИЯ 2: ЭНТРОПИЯ ИЗМЕНЕНИЯ ЗНАКА (НОРМАЛИЗОВАНА [0, 1]) ---

/**
 * Рассчитывает энтропию на основе изменения знака (направления) движения цены.
 * Результат нормализован в диапазон [0, 1], где 1 — полный хаос направления (случайный флип-флоп).
 * Использует три символа: 1 (Up), -1 (Down), 0 (Flat).
 *
 * @param series Объект PriceSeries с данными свечей.
 * @param windowLength Длина окна (количество свечей), для которых рассчитывается энтропия (по умолчанию 100).
 * @returns Нормализованное значение энтропии в диапазоне [0, 1].
 */
export function calculateSignEntropy(
  series: PriceSeries,
  windowLength: number = 100,
): number {
  const closePrices = series.closePrice;
  const arrayLength = closePrices.length;

  if (arrayLength < windowLength + 1) {
    return NaN;
  }

  // 1. Берем окно цен
  const closeWindow = closePrices.slice(arrayLength - windowLength - 1);

  // 2. Генерируем троичный массив и считаем частоты
  const counts = [0, 0, 0]; // Индексы: 0 (-1 Down), 1 (0 Flat), 2 (1 Up)
  const signValues: number[] = [];

  for (let i = 1; i < closeWindow.length; i++) {
    const diff = closeWindow[i] - closeWindow[i - 1];

    if (diff > 0) {
      signValues.push(1);
      counts[2]++; // Up
    } else if (diff < 0) {
      signValues.push(-1);
      counts[0]++; // Down
    } else {
      signValues.push(0);
      counts[1]++; // Flat
    }
  }

  const total = signValues.length;
  if (total === 0) {
    return 0;
  }

  // 3. Нормализуем и вычисляем ненормализованную энтропию H
  const probs = counts.map((c) => c / total);
  let nonNormalizedEntropy = -probs
    .filter((p) => p > 0)
    .reduce((sum, p) => sum + p * Math.log(p), 0);

  // 4. ✅ ИЗМЕНЕНИЕ №2: Нормализация в диапазон [0, 1]
  return nonNormalizedEntropy / MAX_ENTROPY_3_BINS;
}
