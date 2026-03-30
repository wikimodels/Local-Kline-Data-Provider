import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class RvwapRegimeService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateRvwapStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateRvwapStats(data: MarketData) {
    const timeMap = new Map<
      number,
      {
        fomo: number; // > Band 2
        bull: number; // > Band 1
        neutral: number; // Inside Bands
        bear: number; // < Band 1
        panic: number; // < Band 2
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], fomo: [], bull: [], neutral: [], bear: [], panic: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { fomo: 0, bull: 0, neutral: 0, bear: 0, panic: 0, totalScanned: 0 });
        }

        const counts = timeMap.get(time)!;
        const ca = c as any;

        // Проверяем наличие флагов (достаточно проверить один, т.к. они идут пакетом)
        if (ca.isAboveRvwapUpperBand2 === undefined) continue;

        counts.totalScanned++;

        // 2. Агрегация с приоритетом (от краев к центру)
        if (ca.isAboveRvwapUpperBand2) {
          counts.fomo++;
        } else if (ca.isAboveRvwapUpperBand1) {
          counts.bull++;
        } else if (ca.isBelowRvwapLowerBand2) {
          counts.panic++;
        } else if (ca.isBelowRvwapLowerBand1) {
          counts.bear++;
        } else {
          // Если не пробили ни одну из зон 1, значит мы внутри (Neutral)
          // Можно явно проверить ca.isBetweenRvwapBands, но else надежнее
          counts.neutral++;
        }
      }
    }

    // 3. Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      fomo: [] as number[],
      bull: [] as number[],
      neutral: [] as number[],
      bear: [] as number[],
      panic: [] as number[],
      totalScanned: [] as number[],
    };

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const counts = timeMap.get(t)!;
      result.dates.push(fmt.format(new Date(t)));

      result.fomo.push(counts.fomo);
      result.bull.push(counts.bull);
      result.neutral.push(counts.neutral);
      result.bear.push(counts.bear);
      result.panic.push(counts.panic);

      result.totalScanned.push(counts.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No RVWAP Data (${tf})`,
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
        order: 'seriesDesc', // Сверху вниз (FOMO -> Panic)
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.totalScanned && data.totalScanned[index]) {
            res += ` <span style="color:#666; font-size:10px">(Scanned: ${data.totalScanned[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: [
          'FOMO (> Band 2)',
          'Strong Bull (> Band 1)',
          'Neutral (Inside)',
          'Weak Bear (< Band 1)',
          'Panic (< Band 2)',
        ],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'roundRect',
        itemGap: 10,
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '15%', containLabel: true },
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
        // --- UP SIDE ---
        {
          name: 'FOMO (> Band 2)',
          type: 'bar',
          stack: 'total',
          data: data.fomo,
          itemStyle: { color: '#00e676' }, // Ядреный зеленый (Extreme)
          emphasis: { focus: 'series' },
        },
        {
          name: 'Strong Bull (> Band 1)',
          type: 'bar',
          stack: 'total',
          data: data.bull,
          itemStyle: { color: '#2e7d32' }, // Темный зеленый (Trend)
          emphasis: { focus: 'series' },
        },

        // --- NEUTRAL ---
        {
          name: 'Neutral (Inside)',
          type: 'bar',
          stack: 'total',
          data: data.neutral,
          itemStyle: { color: '#757575' }, // Серый (Flat/Chop)
          emphasis: { focus: 'series' },
        },

        // --- DOWN SIDE ---
        {
          name: 'Weak Bear (< Band 1)',
          type: 'bar',
          stack: 'total',
          data: data.bear,
          itemStyle: { color: '#c62828' }, // Темный красный (Trend)
          emphasis: { focus: 'series' },
        },
        {
          name: 'Panic (< Band 2)',
          type: 'bar',
          stack: 'total',
          data: data.panic,
          itemStyle: { color: '#ff1744' }, // Ядреный красный (Extreme)
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
