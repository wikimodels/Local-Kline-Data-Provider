// projects/data-core/src/lib/calculations/time-utils.ts (ОБНОВЛЕНО: БЕЗ БУФЕРА)

// Словарь длительностей интервалов в миллисекундах
const DURATION_MAP: { [key: string]: number } = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/**
 * Возвращает МАКСИМАЛЬНО допустимую длительность кэша (равную длительности интервала) в мс.
 * @param interval Таймфрейм (например, '4h', '1d').
 */
export function getIntervalDurationMs(interval: string): number {
  return DURATION_MAP[interval.toLowerCase()] || 0;
}
