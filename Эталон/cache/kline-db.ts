import Dexie, { Table } from 'dexie';
import { CoinData } from '../../../models/coin-data.model';
import { MarketData } from '../../../models/kline.model';
// --- Модели ---
// (Пути к моделям могут потребовать небольшой корректировки в зависимости от вашей структуры)

const DB_NAME = 'KlineCacheDB';
const DB_VERSION = 1;

/**
 * Wrapper для хранения массива CoinData с ID
 * (Тот же паттерн, что и в analysis-db.ts)
 */
export interface CoinsDataWrapper {
  id: string;
  coins: CoinData[];
}

/**
 * Расширение класса Dexie для определения схемы нашей кеш-базы.
 */
export class KlineDB extends Dexie {
  /**
   * Таблица для хранения MarketData (ключ - timeframe)
   */
  marketData!: Table<MarketData, string>; // string = timeframe

  /**
   * Таблица для хранения мастер-списка CoinData (ключ - 'MASTER_COIN_LIST')
   */
  coinsData!: Table<CoinsDataWrapper, string>; // string = id

  constructor() {
    super(DB_NAME);
    this.version(DB_VERSION).stores({
      /**
       * 'marketData' хранит MarketData.
       * '&timeframe' означает, что свойство 'timeframe' внутри объекта
       * MarketData будет использоваться как уникальный первичный ключ.
       */
      marketData: '&timeframe',

      /**
       * 'coinsData' хранит CoinsDataWrapper.
       * '&id' означает, что свойство 'id' будет первичным ключом.
       */
      coinsData: '&id',
    });
  }
}
