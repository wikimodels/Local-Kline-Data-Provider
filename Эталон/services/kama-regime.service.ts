import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class KamaRegimeService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateKamaStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateKamaStats(data: MarketData) {
    // Map: Time -> { above, below, totalScanned }
    const timeMap = new Map<number, { above: number; below: number; totalScanned: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], above: [], below: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { above: 0, below: 0, totalScanned: 0 });
        }

        const counts = timeMap.get(time)!;
        const ca = c as any;

        // Проверяем наличие данных KAMA
        if (ca.isAboveKama === undefined) continue;

        counts.totalScanned++;

        // 2. Считаем состояния (States)
        if (!!ca.isAboveKama) counts.above++;
        if (!!ca.isBelowKama) counts.below++;
      }
    }

    // 3. Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      above: [] as number[],
      below: [] as number[],
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
      result.above.push(counts.above);
      result.below.push(counts.below);
      result.totalScanned.push(counts.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No KAMA Data (${tf})`,
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
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Above KAMA (Bullish)', 'Below KAMA (Bearish)'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'roundRect',
        itemGap: 15,
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
        // ABOVE KAMA
        {
          name: 'Above KAMA (Bullish)',
          type: 'bar',
          stack: 'total',
          data: data.above,
          itemStyle: { color: '#00e676' }, // Яркий зеленый
          emphasis: { focus: 'series' },
        },
        // BELOW KAMA
        {
          name: 'Below KAMA (Bearish)',
          type: 'bar',
          stack: 'total',
          data: data.below,
          itemStyle: { color: '#ff1744' }, // Яркий красный
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
