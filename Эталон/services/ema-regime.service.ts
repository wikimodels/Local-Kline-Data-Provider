import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class EmaRegimeService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateEmaStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateEmaStats(data: MarketData) {
    // 6 метрик состояния (States Only) + TotalScanned
    const timeMap = new Map<
      number,
      {
        above50: number;
        above100: number;
        above150: number;
        below50: number;
        below100: number;
        below150: number;
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        above50: [],
        above100: [],
        above150: [],
        below50: [],
        below100: [],
        below150: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            above50: 0,
            above100: 0,
            above150: 0,
            below50: 0,
            below100: 0,
            below150: 0,
            totalScanned: 0,
          });
        }

        const counts = timeMap.get(time)!;
        const ca = c as any;

        // Проверяем наличие данных о состоянии EMA (не undefined)
        // Достаточно проверить одно поле, т.к. они рассчитываются вместе
        if (ca.isAboveEma50 === undefined) continue;

        counts.totalScanned++;

        // 2. Считаем ТОЛЬКО состояния (States)
        if (!!ca.isAboveEma50) counts.above50++;
        if (!!ca.isAboveEma100) counts.above100++;
        if (!!ca.isAboveEma150) counts.above150++;

        if (!!ca.isBelowEma50) counts.below50++;
        if (!!ca.isBelowEma100) counts.below100++;
        if (!!ca.isBelowEma150) counts.below150++;
      }
    }

    // 3. Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result: any = { dates: [] };
    const keys = [
      'above50',
      'above100',
      'above150',
      'below50',
      'below100',
      'below150',
      'totalScanned',
    ];
    keys.forEach((k) => (result[k] = []));

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const counts = timeMap.get(t)! as any;
      result.dates.push(fmt.format(new Date(t)));
      keys.forEach((k) => result[k].push(counts[k]));
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No EMA Data (${tf})`,
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
        data: [
          'Above 150 (Trend)',
          'Above 100',
          'Above 50 (Momentum)',
          'Below 150 (Trend)',
          'Below 100',
          'Below 50 (Momentum)',
        ],
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
        // BULLISH TRENDS (Зеленый градиент)
        {
          name: 'Above 150 (Trend)',
          type: 'bar',
          stack: 'total',
          data: data.above150,
          itemStyle: { color: '#1b5e20' }, // Темный зеленый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Above 100',
          type: 'bar',
          stack: 'total',
          data: data.above100,
          itemStyle: { color: '#2e7d32' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Above 50 (Momentum)',
          type: 'bar',
          stack: 'total',
          data: data.above50,
          itemStyle: { color: '#66bb6a' }, // Светлый зеленый
          emphasis: { focus: 'series' },
        },

        // BEARISH TRENDS (Красный градиент)
        {
          name: 'Below 150 (Trend)',
          type: 'bar',
          stack: 'total',
          data: data.below150,
          itemStyle: { color: '#b71c1c' }, // Темный красный
          emphasis: { focus: 'series' },
        },
        {
          name: 'Below 100',
          type: 'bar',
          stack: 'total',
          data: data.below100,
          itemStyle: { color: '#c62828' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Below 50 (Momentum)',
          type: 'bar',
          stack: 'total',
          data: data.below50,
          itemStyle: { color: '#ef5350' }, // Светлый красный
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
