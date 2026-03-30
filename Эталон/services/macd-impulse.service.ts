import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class MacdImpulseService {
  // 🔥 Удален CORR_THRESHOLD

  // MACD (12, 26, 9) требует минимум 35 свечей
  private readonly WARMUP_PERIOD = 35;

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    const timeMap = new Map<
      number,
      {
        growBull: number;
        fadeBull: number;
        growBear: number;
        fadeBear: number;
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        growBull: [],
        fadeBull: [],
        growBear: [],
        fadeBear: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      // Пропуск прогрева
      if (coin.candles.length <= this.WARMUP_PERIOD) continue;

      for (let i = this.WARMUP_PERIOD; i < coin.candles.length; i++) {
        const curr = coin.candles[i] as any;
        const prev = coin.candles[i - 1] as any;
        const time = curr.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            growBull: 0,
            fadeBull: 0,
            growBear: 0,
            fadeBear: 0,
            totalScanned: 0,
          });
        }

        const counts = timeMap.get(time)!;

        // 1. Проверка существования данных
        if (
          curr.macdHistogram === null ||
          curr.macdHistogram === undefined ||
          prev.macdHistogram === null ||
          prev.macdHistogram === undefined
        ) {
          continue;
        }

        // 2. Приведение к числу
        const h = Number(curr.macdHistogram);
        const hPrev = Number(prev.macdHistogram);

        // 3. Проверка на NaN
        if (isNaN(h) || isNaN(hPrev)) {
          continue;
        }

        // Если реальный ноль у обоих — пропускаем (возможно, нет торгов)
        if (h === 0 && hPrev === 0) continue;

        counts.totalScanned++;

        // --- ЛОГИКА ИМПУЛЬСА ---

        if (h >= 0) {
          // === ЗЕЛЕНАЯ ЗОНА (BULLS) ===
          if (h > hPrev) {
            counts.growBull++; // Растущий бычий импульс
          } else {
            counts.fadeBull++; // Затухающий бычий импульс
          }
        } else {
          // === КРАСНАЯ ЗОНА (BEARS) ===
          if (h < hPrev) {
            counts.growBear++; // Растущий медвежий импульс (более глубокий минус)
          } else {
            counts.fadeBear++; // Затухающий медвежий импульс (отскок вверх)
          }
        }
      }
    }

    // Сортировка по времени
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      growBull: [] as number[],
      fadeBull: [] as number[],
      growBear: [] as number[],
      fadeBear: [] as number[],
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
      result.dates.push(fmt.format(new Date(t)));

      result.growBull.push(c.growBull);
      result.fadeBull.push(c.fadeBull);

      // Отрицательные значения для графика "вниз"
      result.fadeBear.push(-c.fadeBear);
      result.growBear.push(-c.growBear);

      result.totalScanned.push(c.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Valid MACD Data (${tf})`,
          subtext: 'Not enough history for calculation',
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
        order: 'seriesDesc',
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.totalScanned && data.totalScanned[index]) {
            res += ` <span style="color:#666; font-size:10px">(Scanned: ${data.totalScanned[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            const val = Math.abs(p.value);
            if (val > 0) {
              res += `${p.marker} ${p.seriesName}: <b>${val}</b><br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        data: [
          'Growing Bull (Momentum)',
          'Fading Bull (Weak)',
          'Fading Bear (Rebound)',
          'Growing Bear (Dump)',
        ],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'roundRect',
        itemGap: 10,
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '12%', containLabel: true },
      dataZoom: [{ type: 'inside', xAxisIndex: [0], start: 0, end: 100 }],
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
          name: 'Growing Bull (Momentum)',
          type: 'bar',
          stack: 'up',
          data: data.growBull,
          itemStyle: { color: '#00e676' }, // Яркий зеленый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Fading Bull (Weak)',
          type: 'bar',
          stack: 'up',
          data: data.fadeBull,
          itemStyle: { color: '#b9f6ca' }, // Бледный зеленый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Fading Bear (Rebound)',
          type: 'bar',
          stack: 'down',
          data: data.fadeBear,
          itemStyle: { color: '#ef9a9a' }, // Бледный красный
          emphasis: { focus: 'series' },
        },
        {
          name: 'Growing Bear (Dump)',
          type: 'bar',
          stack: 'down',
          data: data.growBear,
          itemStyle: { color: '#d50000' }, // Яркий красный
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
