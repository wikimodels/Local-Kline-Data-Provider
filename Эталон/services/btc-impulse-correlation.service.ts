import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class BtcImpulseCorrelationService {
  // Порог Z-Score для определения "Импульса" на Биткоине
  private readonly BTC_Z_THRESHOLD = 1.5;
  // Порог Z-Score для реакции альта (чтобы считать это сильным движением)
  private readonly ALT_Z_THRESHOLD = 1.0;

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    // 1. Ищем Биткоин
    // Обычно он называется BTCUSDT, но добавим проверку
    const btcCoin = data.data.find((c) => c.symbol === 'BTCUSDT' || c.symbol === 'BTCUSDC');

    if (!btcCoin || !btcCoin.candles || btcCoin.candles.length < 50) {
      // Если битка нет, возвращаем пустоту
      return { dates: [], panicDump: [], strongHold: [], fomoPump: [], totalScanned: [] };
    }

    // 2. Считаем метрики Биткоина (Returns + Z-Score)
    // Map: Time -> { zScore, isDump, isPump }
    const btcMap = new Map<number, { zScore: number; isDump: boolean; isPump: boolean }>();

    // Хелпер для расчета изменения внутри свечи (Body Return)
    const getBodyReturn = (c: any) => (c.closePrice - c.openPrice) / c.openPrice;

    // Считаем массив изменений для BTC
    const btcReturns = btcCoin.candles.map(getBodyReturn);
    // Считаем Z-Score
    const btcZScores = this.calculateZScore(btcReturns, 50);

    btcCoin.candles.forEach((c, i) => {
      const z = btcZScores[i];
      if (isNaN(z)) return;

      btcMap.set(c.openTime, {
        zScore: z,
        isDump: z < -this.BTC_Z_THRESHOLD,
        isPump: z > this.BTC_Z_THRESHOLD,
      });
    });

    // 3. Анализируем Альткоины
    const timeMap = new Map<
      number,
      { panicDump: number; strongHold: number; fomoPump: number; totalScanned: number }
    >();

    for (const coin of data.data) {
      if (coin.symbol === btcCoin.symbol) continue; // Пропускаем сам биток
      if (!coin.candles) continue;

      // Локальный расчет Z-Score для альта (чтобы понять его "норму" волатильности)
      const altReturns = coin.candles.map(getBodyReturn);
      const altZScores = this.calculateZScore(altReturns, 50);

      for (let i = 0; i < coin.candles.length; i++) {
        const c = coin.candles[i];
        const time = c.openTime;

        // Смотрим, что делал Биток в это время
        const btcState = btcMap.get(time);

        // Если Биток спал (не было импульса), нам пофиг на альты
        if (!btcState || (!btcState.isDump && !btcState.isPump)) continue;

        if (!timeMap.has(time)) {
          timeMap.set(time, { panicDump: 0, strongHold: 0, fomoPump: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        const altZ = altZScores[i];
        if (isNaN(altZ)) continue;

        counts.totalScanned++;

        // СЦЕНАРИЙ 1: БИТКОИН ОБСИРАЕТСЯ (DUMP)
        if (btcState.isDump) {
          // Альткоин тоже обсирается (Копирует падение)
          if (altZ < -this.ALT_Z_THRESHOLD) {
            counts.panicDump++;
          }
          // Альткоин держится молодцом (Сила)
          else if (altZ > -0.5) {
            // Упал совсем чуть-чуть или вырос
            counts.strongHold++;
          }
        }

        // СЦЕНАРИЙ 2: БИТКОИН ЛЕТИТ (PUMP)
        if (btcState.isPump) {
          // Альткоин летит следом (FOMO)
          if (altZ > this.ALT_Z_THRESHOLD) {
            counts.fomoPump++;
          }
        }
      }
    }

    // Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      panicDump: [] as number[],
      strongHold: [] as number[],
      fomoPump: [] as number[],
      totalScanned: [] as number[],
    };

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const c = timeMap.get(t)!;
      // Рисуем, только если были данные
      if (c.totalScanned > 0) {
        result.dates.push(fmt.format(new Date(t)));
        // Panic Dump - Красный (Вниз)
        result.panicDump.push(-c.panicDump);
        // Strong Hold - Зеленый (Вверх, когда биток падает)
        result.strongHold.push(c.strongHold);
        // Fomo Pump - Желтый/Синий (Вверх, когда биток растет) - можно наложить на Hold или отдельно
        result.fomoPump.push(c.fomoPump);

        result.totalScanned.push(c.totalScanned);
      }
    }

    return result;
  }

  // Утилита для расчета Z-Score массива
  private calculateZScore(series: number[], window: number): number[] {
    const len = series.length;
    const output = new Array(len).fill(NaN);
    if (len < window) return output;

    for (let i = window - 1; i < len; i++) {
      const slice = series.slice(i - window + 1, i + 1);

      // Mean
      const sum = slice.reduce((a, b) => a + b, 0);
      const mean = sum / window;

      // StdDev
      const sumSq = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
      const std = Math.sqrt(sumSq / window);

      if (std > 1e-9) {
        output[i] = (series[i] - mean) / std;
      } else {
        output[i] = 0;
      }
    }
    return output;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No BTC Impulse Events (${tf})`,
          subtext: 'Market is calm or BTC not found',
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
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b> (BTC Impulse Event)<br/>`;
          params.forEach((p: any) => {
            const val = Math.abs(p.value);
            if (val > 0) res += `${p.marker} ${p.seriesName}: <b>${val}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: [
          'Panic Dump (Follow BTC Down)',
          'Strong Hold (Resist BTC Drop)',
          'FOMO Pump (Follow BTC Up)',
        ],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '12%', containLabel: true },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      xAxis: {
        type: 'category',
        data: data.dates,
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
        axisLabel: { color: '#888' },
        name: 'Coins Count',
      },
      series: [
        {
          name: 'Panic Dump (Follow BTC Down)',
          type: 'bar',
          stack: 'total',
          data: data.panicDump,
          itemStyle: { color: '#d50000' }, // Кроваво-красный
        },
        {
          name: 'Strong Hold (Resist BTC Drop)',
          type: 'bar',
          stack: 'total',
          data: data.strongHold,
          itemStyle: { color: '#00e676' }, // Ярко-зеленый (Сила)
        },
        {
          name: 'FOMO Pump (Follow BTC Up)',
          type: 'bar',
          stack: 'total',
          data: data.fomoPump,
          itemStyle: { color: '#2979ff' }, // Синий
        },
      ],
    };
  }
}
