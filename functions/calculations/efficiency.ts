import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает Kaufman's Efficiency Ratio (ER).
 * Коэффициент эффективности движения.
 *
 * Формула: ER = Direction / Volatility
 * - Direction: Абсолютное изменение цены за период (Net Change).
 * - Volatility: Сумма абсолютных изменений от свечи к свече (сумма шума).
 *
 * Диапазон значений: от 0.0 до 1.0.
 * - 1.0: Идеальное трендовое движение (цена шла только в одну сторону).
 * - 0.0: Полный шум (цена много двигалась, но вернулась в начало).
 *
 * @param series Данные свечей
 * @param length Период расчета (стандартно 10 или 14)
 */
export function calculateEfficiencyRatio(
  series: PriceSeries,
  length: number = 10,
): number[] {
  const close = series.closePrice;
  const n = close.length;
  // Заполняем NaN, чтобы длина массива совпадала с ценами
  const er: number[] = new Array(n).fill(NaN);

  if (n <= length) return er;

  // Начинаем расчет с индекса length
  for (let i = length; i < n; i++) {
    // 1. Чистое изменение цены за период (кратчайшее расстояние А -> Б)
    const direction = Math.abs(close[i] - close[i - length]);

    // 2. Сумма всех движений внутри периода (реальный путь цены)
    let volatility = 0;
    for (let j = 0; j < length; j++) {
      // Суммируем разницы между соседними свечами: |Close[k] - Close[k-1]|
      // Индекс текущей свечи в подцикле: i - j
      // Индекс предыдущей: i - j - 1
      const currentIdx = i - j;
      const prevIdx = i - j - 1;

      volatility += Math.abs(close[currentIdx] - close[prevIdx]);
    }

    // 3. Расчет ER
    if (volatility === 0) {
      // Если волатильность 0, значит цена вообще не менялась.
      // Эффективность можно считать 0 (нет движения) или 1 (стабильность).
      // Для трейдинга безопаснее 0.
      er[i] = 0;
    } else {
      er[i] = direction / volatility;
    }
  }

  return er;
}
