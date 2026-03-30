// config.ts
import { load } from "https://deno.land/std@0.215.0/dotenv/mod.ts";

await load({ export: true });

export const CONFIG = {
  PROJECT_NAME: "DenoKlineDataProvider",

  /**
   * Telegram Bot Configuration
   */
  TELEGRAM: {
    BOT_TOKEN: Deno.env.get("TG_TECHNICALS_BOT") || "",
    USER_ID: Deno.env.get("TG_USER_ID") || "",
  },

  /**
   * Number of candles saved to cache.
   */
  SAVE_LIMIT: 400,

  /**
   * --- KLINE (Candles) ---
   * Limits for fetchKlineData
   */
  KLINE: {
    h1: 601,
    h4_DIRECT: 401,
    h4_BASE: 801,
    h12_DIRECT: 401,
    h12_BASE: 801,
  },

  /**
   * --- OPEN INTEREST (OI) ---
   */
  OI: {
    h1_GLOBAL: 720,
  },

  /**
   * --- FUNDING RATE (FR) ---
   */
  FR: {
    h4_RECENT: 401,
  },

  /**
   * --- THROTTLING (Rate limiting) ---
   */
  THROTTLING: {
    BATCH_SIZE: 7,
    DELAY_MS: 400,
  },

  /**
   * --- DELAYS ---
   */
  DELAYS: {
    DELAY_BTW_TASKS: 3000,
  },

  /**
   * --- STORAGE DRIVER ---
   */
  STORAGE: {
    DRIVER: (Deno.env.get("STORAGE_DRIVER") || "memory") as "redis" | "memory",
  },
};
