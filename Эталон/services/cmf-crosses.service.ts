import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class CmfCrossesService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateCrossStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateCrossStats(data: MarketData) {
    // Map: Time -> { up, down, scanned }
    const timeMap = new Map<number, { up: number; down: number; scanned: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], up: [], down: [], scanned: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { up: 0, down: 0, scanned: 0 });
        }

        const counts = timeMap.get(time)!;

        // Используем готовые флаги из бэкенда (рассчитаны в pipeline)
        const candle = c as any;

        // Проверяем наличие хотя бы одного флага
        if (
          candle.isCmfSlopeUp == null &&
          candle.isCmfSlopeDown == null
        ) {
          continue; // Нет данных для этой свечи
        }

        counts.scanned++;

        // Считаем монеты в каждом состоянии
        if (candle.isCmfSlopeUp === true) counts.up++;
        if (candle.isCmfSlopeDown === true) counts.down++;
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      up: [] as number[],
      down: [] as number[],
      scanned: [] as number[],
    };

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const counts = timeMap.get(t)!;
      if (counts.scanned > 0) {
        result.dates.push(fmt.format(new Date(t)));
        result.up.push(counts.up);
        result.down.push(counts.down);
        result.scanned.push(counts.scanned);
      }
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No CMF Crosses Data (${tf})`,
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
          // Инфо о кол-ве монет
          const index = params[0].dataIndex;
          if (data.scanned && data.scanned[index]) {
            res += ` <span style="color:#666; font-size:10px">(Scanned: ${data.scanned[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Slope Turn Up (Strengthening)', 'Slope Turn Down (Weakening)'],
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
        name: 'Events Count',
      },
      series: [
        {
          name: 'Slope Turn Up (Strengthening)',
          type: 'bar',
          stack: 'total',
          data: data.up,
          itemStyle: { color: '#00e676' }, // Лайм
          emphasis: { focus: 'series' },
        },
        {
          name: 'Slope Turn Down (Weakening)',
          type: 'bar',
          stack: 'total',
          data: data.down,
          itemStyle: { color: '#d50000' }, // Красный
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
