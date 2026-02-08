/**
 * Преобразует массив цен в массив логарифмических доходностей.
 * r_t = log(P_t / P_{t-1})
 * Длина результата будет на 1 меньше исходного массива.
 */
export function getLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    // Math.log(a / b) === Math.log(a) - Math.log(b)
    // Используем разность логарифмов (стабильнее)
    const val = Math.log(prices[i]) - Math.log(prices[i - 1]);
    returns.push(val);
  }
  return returns;
}
