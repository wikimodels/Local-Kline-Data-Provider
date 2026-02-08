import { CONFIG } from "../config.ts";
import { RedisStore } from "./redis-store.ts";
import { MemoryStore } from "./memory-store.ts";
import { MarketData, TF, DColors } from "../models/types.ts";
import { logger } from "../core/utils/logger.ts";

/**
 * Единый интерфейс для всех хранилищ.
 * Содержит ТОЛЬКО общие методы.
 * Методы isStale и getCacheAge намеренно исключены по требованию.
 */
export interface IDataStore {
  init(): void;
  save(timeframe: TF, snapshot: MarketData): Promise<void>;
  get(timeframe: TF): Promise<MarketData | null>;
  getAll(): Promise<MarketData[]>;
  clear(): Promise<void>;
}

let store: IDataStore;

if (CONFIG.STORAGE.DRIVER === "memory") {
  logger.info("🗄️ [STORAGE] Using MEMORY store (NodeCache)", DColors.cyan);
  store = MemoryStore;
} else {
  logger.info("🗄️ [STORAGE] Using REDIS store (Upstash)", DColors.cyan);
  store = RedisStore;
}

/**
 * Единая точка доступа к хранилищу (Redis или Memory).
 * Выбор определяется в CONFIG.STORAGE.DRIVER.
 */
export const DataStore: IDataStore = store;
