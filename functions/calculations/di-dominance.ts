import { PriceSeries } from "../../models/types.ts";

/**
 * Рассчитывает DI+ Dominance (Доминирование быков).
 *
 * Метрика показывает процент времени, когда покупатели контролировали рынок (DI+ > DI-).
 *
 * Формула:
 * Dominance = (Count Bars where DI+ > DI-) / Total Bars in Window
 *
 * Интерпретация:
 * - > 0.70: Бычий режим (Bull Regime).
 * - < 0.30: Медвежий режим (Bear Regime).
 * - ~ 0.50: Чоп / Неопределенность.
 *
 * ⚠️ Важно: Использовать только в связке с ADX для подтверждения силы тренда.
 *
 * @param diPlus Массив значений DI+
 * @param diMinus Массив значений DI-
 * @param window Размер окна расчета (стандартно 50)
 */
export function calculateDiPlusDominance(
  diPlus: number[],
  diMinus: number[],
  window: number = 50,
): number[] {
  const n = diPlus.length;
  // Инициализируем NaN
  const result: number[] = new Array(n).fill(NaN);

  // Проверка длин массивов
  if (n !== diMinus.length || n < window) return result;

  // Скользящее окно
  for (let i = window - 1; i < n; i++) {
    let bullWins = 0;
    let validBars = 0;

    for (let j = 0; j < window; j++) {
      const p = diPlus[i - j];
      const m = diMinus[i - j];

      // Защита от NaN (если индикатор еще не прогрелся)
      if (!Number.isNaN(p) && !Number.isNaN(m)) {
        validBars++;

        if (p > m) {
          bullWins++;
        }
      }
    }

    if (validBars > 0) {
      result[i] = bullWins / validBars;
    } else {
      result[i] = 0; // Или NaN, если данных нет вообще
    }
  }

  return result;
}
