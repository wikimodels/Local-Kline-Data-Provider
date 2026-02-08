// config.ts

/**
 * Central configuration file for all request limits.
 * - "SAVE_LIMIT" (400): Number of candles always saved to cache.
 * - "FETCH_LIMIT" (401): SAVE_LIMIT + 1 (to compensate for API trimming).
 * - "BASE_LIMIT" (801): (SAVE_LIMIT * 2) + 1 (for 2:1 combination and compensation).
 */
export const CONFIG = {
  PROJECT_NAME: "DenoKlineDataProvider",

  /**
   * Number of candles saved to cache.
   */
  SAVE_LIMIT: 400,

  /**
   * --- KLINE (Candles) ---
   * Limits for fetchKlineData
   */
  KLINE: {
    /**
     * Direct 1h request (400 + 1).
     * Used in: job-1h, job-4h, job-8h, job-12h, job-1d.
     */
    h1: 601,

    /**
     * Direct 4h request (400 + 1).
     * Used in: job-4h.
     */
    h4_DIRECT: 401,

    /**
     * Base 4h set (800 + 1) for combining into 8h.
     * Used in: job-8h, job-12h, job-1d.
     */
    h4_BASE: 801,

    /**
     * Direct 12h request (400 + 1).
     * Used in: job-12h (OPTIMIZATION).
     */
    h12_DIRECT: 401,

    /**
     * Base 12h set (800 + 1) for combining into 1D.
     * Used in: job-1d.
     */
    h12_BASE: 801,
  },

  /**
   * --- OPEN INTEREST (OI) ---
   */
  OI: {
    /**
     * OI 1h (720) for enriching all timeframes.
     */
    h1_GLOBAL: 720,
  },

  /**
   * --- FUNDING RATE (FR) ---
   */
  FR: {
    /**
     * FR needed for enriching FRESH 4h candles (400 + 1).
     * (Used in job-4h, job-8h, job-12h, job-1d).
     */
    h4_RECENT: 401,
  },

  /**
   * --- THROTTLING (Rate limiting) ---
   * Constants for controlling Binance limits (2400 req/min).
   * 10 requests @ 400ms delay = ~1500 req/min (safe).
   */
  THROTTLING: {
    /**
     * Maximum number of parallel requests in one batch.
     */
    BATCH_SIZE: 50,

    /**
     * Delay in milliseconds between batch executions.
     * (BATCH_SIZE * 40ms) = 400ms.
     */
    DELAY_MS: 300,
  },

  /**
   * --- DELAYS ---
   * Delays between individual tasks.
   */
  DELAYS: {
    /**
     * Delay between fetch operations in job-4h and job-8h (ms).
     * Used between: OI → FR → Klines.
     */
    DELAY_BTW_TASKS: 3000,
  },

  /**
   * --- STORAGE DRIVER ---
   * Cache storage selection.
   * "redis": Upstash Redis (persistent, with compression)
   * "memory": In-memory (no compression, resets on restart)
   */
  STORAGE: {
    DRIVER: "memory" as "redis" | "memory",
  },
};
