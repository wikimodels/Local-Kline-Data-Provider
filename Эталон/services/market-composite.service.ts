import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class MarketCompositeService {
  // 🔥 Удален CORR_THRESHOLD
  private readonly BTC_SYMBOL = 'BTCUSDT';

  /**
   * Главный метод: принимает все данные, возвращает конфиги графиков для каждого ТФ.
   */
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const compositeData = this.calculateCompositeCandles(marketData);
      charts[timeframe] = this.buildChart(compositeData, timeframe);
    });

    return charts;
  }

  /**
   * Расчет композитных свечей и линии BTC.
   */
  private calculateCompositeCandles(data: MarketData) {
    if (!data.data || data.data.length === 0) {
      return { dates: [], candles: [], btcLine: [] };
    }

    // 1. Ищем BTC для линии сравнения
    const btcCoin = data.data.find(
      (c) => c.symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === this.BTC_SYMBOL,
    );

    // Map: Time -> Arrays of normalized values
    const timeMap = new Map<number, { o: number[]; h: number[]; l: number[]; c: number[] }>();

    // 2. Проходим по всем монетам и собираем данные
    for (const coin of data.data) {
      // Исключаем сам биток из расчета "толпы"
      const cleanSymbol = coin.symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (cleanSymbol === this.BTC_SYMBOL) continue;

      // 🔥 УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Берем весь рынок.

      for (const candle of coin.candles) {
        // Проверяем наличие нормализованных данных
        const o = (candle as any).openPriceNorm;
        const h = (candle as any).highPriceNorm;
        const l = (candle as any).lowPriceNorm;
        const c = (candle as any).closePriceNorm;

        if (
          o === undefined ||
          Number.isNaN(o) ||
          h === undefined ||
          Number.isNaN(h) ||
          l === undefined ||
          Number.isNaN(l) ||
          c === undefined ||
          Number.isNaN(c)
        ) {
          continue;
        }

        const time = candle.openTime;
        if (!timeMap.has(time)) {
          timeMap.set(time, { o: [], h: [], l: [], c: [] });
        }

        const bucket = timeMap.get(time)!;
        bucket.o.push(o);
        bucket.h.push(h);
        bucket.l.push(l);
        bucket.c.push(c);
      }
    }

    // 3. Агрегируем (считаем медиану)
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const dates: string[] = [];
    const candles: number[][] = []; // [Open, Close, Low, High, Count]
    const btcLine: (number | null)[] = [];

    // Подготовим быстрый поиск BTC свечей по времени
    const btcCandleMap = new Map<number, number>();
    if (btcCoin) {
      btcCoin.candles.forEach((c) => {
        const val = (c as any).closePriceNorm;
        if (val !== undefined && !Number.isNaN(val)) {
          btcCandleMap.set(c.openTime, val);
        }
      });
    }

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const bucket = timeMap.get(t)!;

      // Нужен хотя бы минимальный кворум
      if (bucket.c.length < 3) continue;

      const medOpen = this.getMedian(bucket.o);
      const medHigh = this.getMedian(bucket.h);
      const medLow = this.getMedian(bucket.l);
      const medClose = this.getMedian(bucket.c);
      const coinCount = bucket.c.length;

      dates.push(fmt.format(new Date(t)));

      // ECharts Candlestick: [Open, Close, Low, High, Count]
      // Мы добавляем Count 5-м элементом, чтобы достать его в тултипе
      candles.push([medOpen, medClose, medLow, medHigh, coinCount]);

      // Добавляем точку BTC
      btcLine.push(btcCandleMap.get(t) ?? null);
    }

    return { dates, candles, btcLine };
  }

  /**
   * Построение графика ECharts
   */
  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `Not enough data (${tf})`,
          subtext: 'Try syncing more coins',
          left: 'center',
          top: 'center',
          textStyle: { color: '#666' },
        },
      };
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(20, 20, 25, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let res = `<b>${params[0].name}</b><br/>`;
          params.forEach((param: any) => {
            if (param.seriesName === 'Market Composite') {
              // param.value: [index, open, close, low, high, count]
              const v = param.value;
              // v[1]=O, v[2]=C, v[3]=L, v[4]=H, v[5]=Count
              res += `<span style="color:${param.color}">●</span> Market: O:${v[1]?.toFixed(3)} C:${v[2]?.toFixed(3)} <span style="color:#888; font-size:10px">(n=${v[5]})</span><br/>`;
            } else if (param.seriesName === 'BTC Normalized') {
              res += `<span style="color:${param.color}">●</span> BTC: ${param.value?.toFixed(3)}<br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        data: ['Market Composite', 'BTC Normalized'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc' },
        icon: 'circle',
      },
      grid: { left: '3%', right: '3%', bottom: '10%', top: '10%', containLabel: true },
      toolbox: {
        show: true,
        feature: { restore: { show: true, title: 'Reset Zoom' } },
        iconStyle: { borderColor: '#9090a0' },
        right: '5%',
        top: 0,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      xAxis: {
        type: 'category',
        data: data.dates,
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888' },
      },
      yAxis: {
        type: 'value',
        scale: true,
        min: 0,
        max: 1, // Данные нормализованы 0-1
        splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
        axisLabel: { color: '#888' },
      },
      series: [
        {
          name: 'Market Composite',
          type: 'candlestick',
          data: data.candles,
          itemStyle: {
            color: '#00e676', // Рост
            color0: '#ff2a2a', // Падение
            borderColor: '#00e676',
            borderColor0: '#ff2a2a',
          },
          barWidth: '60%',
        },
        {
          name: 'BTC Normalized',
          type: 'line',
          data: data.btcLine,
          smooth: true,
          showSymbol: false,
          itemStyle: { color: '#ffd740' },
          lineStyle: { color: '#ffd740', width: 2, type: 'solid' },
          z: 5,
        },
      ],
    };
  }

  private getMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
