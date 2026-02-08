# Инструкция для интеграции альтернативного источника данных (Local Kline Data Provider)

## 📋 Контекст

В Angular-проекте **Market Vibe** данные для разных таймфреймов получаются из двух Render-серверов:
- **Сервер 1**: данные для `1h`, `12h`, `1d`
- **Сервер 2**: данные для `4h`, `8h`

Теперь доступен **единый альтернативный источник данных** через Local Kline Data Provider, который предоставляет данные для **всех таймфреймов** (`1h`, `4h`, `8h`, `12h`, `1d`) через один эндпоинт.

---

## 🎯 Задача

Добавить в Angular-проект возможность получать данные из нового источника (Local Kline Data Provider) как альтернативу существующим Render-серверам.

---

## 🔗 API Эндпоинт

### Base URL
```
{NGROK_URL}/api/cache/:tf
```

Где `NGROK_URL` - это URL из переменных окружения (например, `https://your-ngrok-url.ngrok-free.app`)

### Метод
`GET`

### Аутентификация
Все запросы требуют Bearer токен:
```
Authorization: Bearer {SECRET_TOKEN}
```

### URL Параметры

- `:tf` - таймфрейм (обязательный параметр)
  - Допустимые значения: `1h`, `4h`, `8h`, `12h`, `D` (для дневного таймфрейма)
  - Специальное значение: `all` - вернёт данные для всех таймфреймов сразу

---

## 📦 Структура данных

### Запрос для одного таймфрейма

**Пример запроса:**
```bash
GET {NGROK_URL}/api/cache/1h
Authorization: Bearer {SECRET_TOKEN}
```

**Пример ответа (Success 200):**
```json
{
  "success": true,
  "data": {
    "timeframe": "1h",
    "openTime": 1732204800000,
    "updatedAt": 1732288019685,
    "coinsNumber": 150,
    "data": [
      {
        "symbol": "BTCUSDT",
        "candles": [
          {
            "openTime": 1732204800000,
            "openPrice": 45000.1,
            "highPrice": 45010.5,
            "lowPrice": 44990.0,
            "closePrice": 45005.2,
            "volume": 15000000.5,
            "volumeDelta": 500000.1,
            "openInterest": 3348157.87,
            "fundingRate": 0.0001
          }
          // ... больше свечей
        ]
      },
      {
        "symbol": "ETHUSDT",
        "candles": [...]
      }
      // ... больше монет
    ]
  },
  "cached": true
}
```

### Запрос всех таймфреймов

**Пример запроса:**
```bash
GET {NGROK_URL}/api/cache/all
Authorization: Bearer {SECRET_TOKEN}
```

**Пример ответа (Success 200):**
```json
{
  "success": true,
  "data": {
    "1h": {
      "timeframe": "1h",
      "openTime": 1732204800000,
      "updatedAt": 1732288019685,
      "coinsNumber": 150,
      "data": [...]
    },
    "4h": {
      "timeframe": "4h",
      "openTime": 1732204800000,
      "updatedAt": 1732288019685,
      "coinsNumber": 150,
      "data": [...]
    },
    "8h": {...},
    "12h": {...},
    "D": {...}
  }
}
```

---

## 🔧 TypeScript Интерфейсы

Создайте или обновите интерфейсы для типизации данных:

```typescript
// Интерфейс для одной свечи
export interface Candle {
  openTime: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  volumeDelta: number;
  openInterest: number;
  fundingRate: number | null;
}

// Интерфейс для данных одной монеты
export interface CoinMarketData {
  symbol: string;
  candles: Candle[];
}

// Интерфейс для данных одного таймфрейма
export interface MarketData {
  timeframe: string; // "1h" | "4h" | "8h" | "12h" | "D"
  openTime: number;
  updatedAt: number;
  coinsNumber: number;
  data: CoinMarketData[];
}

// Интерфейс для ответа API (один таймфрейм)
export interface CacheResponse {
  success: boolean;
  data: MarketData;
  cached: boolean;
}

// Интерфейс для ответа API (все таймфреймы)
export interface AllCacheResponse {
  success: boolean;
  data: {
    "1h": MarketData;
    "4h": MarketData;
    "8h": MarketData;
    "12h": MarketData;
    "D": MarketData;
  };
}
```

---

## 🛠️ Шаги интеграции

### 1. Добавить переменные окружения

В файл `environment.ts` (или аналогичный):

```typescript
export const environment = {
  production: false,
  
  // Существующие Render серверы
  renderServer1Url: 'https://render-server-1.com',
  renderServer2Url: 'https://render-server-2.com',
  
  // Новый источник данных
  localKlineProviderUrl: 'https://your-ngrok-url.ngrok-free.app',
  localKlineProviderToken: 'your-secret-token-here',
  
  // Флаг для переключения источника данных
  useLocalKlineProvider: false // true для использования нового источника
};
```

### 2. Создать или обновить сервис для работы с API

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MarketDataService {
  
  constructor(private http: HttpClient) {}
  
  /**
   * Получить данные для одного таймфрейма
   */
  getCacheData(timeframe: '1h' | '4h' | '8h' | '12h' | 'D'): Observable<CacheResponse> {
    const url = `${environment.localKlineProviderUrl}/api/cache/${timeframe}`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environment.localKlineProviderToken}`
    });
    
    return this.http.get<CacheResponse>(url, { headers });
  }
  
  /**
   * Получить данные для всех таймфреймов сразу
   */
  getAllCacheData(): Observable<AllCacheResponse> {
    const url = `${environment.localKlineProviderUrl}/api/cache/all`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environment.localKlineProviderToken}`
    });
    
    return this.http.get<AllCacheResponse>(url, { headers });
  }
  
  /**
   * Универсальный метод с переключением источника данных
   */
  getMarketData(timeframe: '1h' | '4h' | '8h' | '12h' | 'D'): Observable<any> {
    if (environment.useLocalKlineProvider) {
      // Использовать новый источник
      return this.getCacheData(timeframe);
    } else {
      // Использовать старые Render серверы
      return this.getDataFromRenderServers(timeframe);
    }
  }
  
  /**
   * Старый метод для получения данных с Render серверов
   */
  private getDataFromRenderServers(timeframe: string): Observable<any> {
    // Ваша существующая логика для Render серверов
    if (['1h', '12h', '1d'].includes(timeframe)) {
      return this.http.get(`${environment.renderServer1Url}/api/${timeframe}`);
    } else {
      return this.http.get(`${environment.renderServer2Url}/api/${timeframe}`);
    }
  }
}
```

### 3. Использовать в компонентах

```typescript
import { Component, OnInit } from '@angular/core';
import { MarketDataService } from './services/market-data.service';

@Component({
  selector: 'app-market-view',
  templateUrl: './market-view.component.html'
})
export class MarketViewComponent implements OnInit {
  
  marketData: MarketData | null = null;
  
  constructor(private marketDataService: MarketDataService) {}
  
  ngOnInit() {
    // Получить данные для 1h таймфрейма
    this.marketDataService.getMarketData('1h').subscribe({
      next: (response) => {
        if (response.success) {
          this.marketData = response.data;
          console.log('Получено монет:', response.data.coinsNumber);
          console.log('Обновлено:', new Date(response.data.updatedAt));
        }
      },
      error: (err) => {
        console.error('Ошибка получения данных:', err);
      }
    });
  }
}
```

---

## ⚙️ Обработка ошибок

### Возможные HTTP коды ответа

- **200 OK** - данные успешно получены
- **400 Bad Request** - неверный таймфрейм
- **401 Unauthorized** - неверный или отсутствующий токен
- **404 Not Found** - кэш для таймфрейма пуст
- **500 Internal Server Error** - ошибка на сервере

### Пример обработки ошибок

```typescript
this.marketDataService.getCacheData('1h').subscribe({
  next: (response) => {
    // Успешный ответ
    this.handleSuccess(response);
  },
  error: (error) => {
    if (error.status === 401) {
      console.error('Ошибка аутентификации. Проверьте токен.');
    } else if (error.status === 404) {
      console.warn('Кэш пуст. Данные ещё не загружены.');
    } else {
      console.error('Неизвестная ошибка:', error);
    }
  }
});
```

---

## 🔄 Автоматическое обновление данных

Данные на сервере обновляются автоматически по расписанию:

| Таймфрейм | Частота обновления |
|-----------|-------------------|
| 1h | Каждый час в :00 |
| 4h | Каждые 4 часа в :00 |
| 8h | Каждые 8 часов в :00 |
| 12h | Каждые 12 часов в :00 |
| 1d | Ежедневно в 00:00 |

Для автоматического обновления в Angular используйте:

```typescript
import { interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Обновлять каждые 5 минут
interval(5 * 60 * 1000)
  .pipe(
    switchMap(() => this.marketDataService.getCacheData('1h'))
  )
  .subscribe(response => {
    this.marketData = response.data;
  });
```

---

## ✅ Чеклист для интеграции

- [ ] Добавить переменные окружения (`localKlineProviderUrl`, `localKlineProviderToken`)
- [ ] Создать/обновить TypeScript интерфейсы для типизации данных
- [ ] Создать/обновить сервис для работы с API
- [ ] Добавить методы для получения данных одного и всех таймфреймов
- [ ] Реализовать переключение между источниками данных (флаг `useLocalKlineProvider`)
- [ ] Добавить обработку ошибок (401, 404, 500)
- [ ] Протестировать получение данных для каждого таймфрейма
- [ ] (Опционально) Добавить автоматическое обновление данных через `interval()`
- [ ] Обновить документацию проекта

---

## 📝 Примечания

1. **Совместимость данных**: Структура данных идентична той, что используется в Render-серверах, поэтому существующая логика обработки данных должна работать без изменений.

2. **Переключение источников**: Используйте флаг `useLocalKlineProvider` в `environment.ts` для быстрого переключения между старыми и новыми источниками данных.

3. **Безопасность**: Храните `SECRET_TOKEN` в безопасном месте и не коммитьте его в публичные репозитории.

4. **NGROK URL**: URL может меняться при перезапуске ngrok. Используйте статический домен или обновляйте URL в переменных окружения.

---

## 🆘 Troubleshooting

**Проблема**: Ошибка 401 Unauthorized  
**Решение**: Проверьте правильность токена в заголовке `Authorization: Bearer {TOKEN}`

**Проблема**: Ошибка 404 Not Found  
**Решение**: Кэш ещё не заполнен. Подождите несколько минут после запуска сервера.

**Проблема**: CORS ошибки  
**Решение**: Сервер уже настроен с `cors()` middleware, но убедитесь, что запросы идут с правильного домена.

**Проблема**: Данные не обновляются  
**Решение**: Проверьте, что cron jobs запущены (должны быть логи в консоли сервера).
