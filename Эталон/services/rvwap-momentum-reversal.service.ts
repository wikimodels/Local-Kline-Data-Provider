import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class RvwapMomentumReversalService {
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
      { topRisk: number; bottomChance: number; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], topRisk: [], bottomChance: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { topRisk: 0, bottomChance: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        // Используем готовые флаги из бэкенда (рассчитаны в pipeline)
        const candle = c as any;

        // Проверяем наличие хотя бы одного флага (если нет - пропускаем)
        if (
          candle.isTopReversalRisk == null &&
          candle.isBottomReversalChance == null
        ) {
          continue; // Нет данных для этой свечи
        }

        counts.totalScanned++;

        // Считаем монеты в каждом состоянии
        if (candle.isTopReversalRisk === true) counts.topRisk++;
        if (candle.isBottomReversalChance === true) counts.bottomChance++;
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      topRisk: [] as number[],
      bottomChance: [] as number[],
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
      if (c.totalScanned > 0) {
        result.dates.push(fmt.format(new Date(t)));
        result.topRisk.push(c.topRisk);
        result.bottomChance.push(-c.bottomChance); // Отрицательные для графика вниз
        result.totalScanned.push(c.totalScanned);
      }
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.totalScanned && data.totalScanned[index]) {
            res += ` <span style="color:#aaa; font-size:10px">(n=${data.totalScanned[index]})</span>`;
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
        data: ['Top Reversal Risk', 'Bottom Reversal Chance'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc' },
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
      },
      series: [
        {
          name: 'Top Reversal Risk',
          type: 'bar',
          stack: 'total',
          data: data.topRisk,
          itemStyle: { color: '#ff3d00' }, // Оранжевый
        },
        {
          name: 'Bottom Reversal Chance',
          type: 'bar',
          stack: 'total',
          data: data.bottomChance,
          itemStyle: { color: '#00e676' }, // Зеленый
        },
      ],
    };
  }
}
