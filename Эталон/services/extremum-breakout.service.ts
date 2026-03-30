import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class ExtremumBreakoutService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateBreakoutStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateBreakoutStats(data: MarketData) {
    // Map: Time -> { up50, up100, down50, down100, totalScanned }
    const timeMap = new Map<
      number,
      { up50: number; up100: number; down50: number; down100: number; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], up50: [], up100: [], down50: [], down100: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { up50: 0, up100: 0, down50: 0, down100: 0, totalScanned: 0 });
        }

        const counts = timeMap.get(time)!;

        // Проверяем наличие полей (достаточно одного, так как они считаются вместе)
        if ((c as any).isCrossedUpHighest50 === undefined) continue;

        counts.totalScanned++;

        // 2. Считаем пробои (приводим к boolean)
        if (!!(c as any).isCrossedUpHighest50) counts.up50++;
        if (!!(c as any).isCrossedUpHighest100) counts.up100++;

        if (!!(c as any).isCrossedDownLowest50) counts.down50++;
        if (!!(c as any).isCrossedDownLowest100) counts.down100++;
      }
    }

    // 3. Сортируем
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      up50: [] as number[],
      up100: [] as number[],
      down50: [] as number[],
      down100: [] as number[],
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
      result.up50.push(c.up50);
      result.up100.push(c.up100);
      result.down50.push(c.down50);
      result.down100.push(c.down100);
      result.totalScanned.push(c.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Breakouts Found (${tf})`,
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
        order: 'valueDesc',
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
        data: ['New High (50)', 'New High (100)', 'New Low (50)', 'New Low (100)'],
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
        name: 'Breakout Count',
      },
      series: [
        // --- UP BREAKOUTS (Greens) ---
        {
          name: 'New High (50)',
          type: 'bar',
          stack: 'total',
          data: data.up50,
          itemStyle: { color: '#69f0ae' }, // Светло-зеленый
          emphasis: { focus: 'series' },
        },
        {
          name: 'New High (100)',
          type: 'bar',
          stack: 'total',
          data: data.up100,
          itemStyle: { color: '#00c853' }, // Темно-зеленый
          emphasis: { focus: 'series' },
        },

        // --- DOWN BREAKOUTS (Reds) ---
        {
          name: 'New Low (50)',
          type: 'bar',
          stack: 'total',
          data: data.down50,
          itemStyle: { color: '#ff5252' }, // Светло-красный
          emphasis: { focus: 'series' },
        },
        {
          name: 'New Low (100)',
          type: 'bar',
          stack: 'total',
          data: data.down100,
          itemStyle: { color: '#d50000' }, // Темно-бордовый
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
