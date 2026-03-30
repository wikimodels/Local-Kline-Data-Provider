import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData, Candle } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class CmfRegimeService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateCmfStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateCmfStats(data: MarketData) {
    // Map: Time -> { inflow, outflow, neutral, totalScanned }
    const timeMap = new Map<
      number,
      { inflow: number; outflow: number; neutral: number; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], inflow: [], outflow: [], neutral: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { inflow: 0, outflow: 0, neutral: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        // Используем CMF из pipeline
        const candle = c as any;
        const val = candle.cmf;

        // Строгая проверка валидности числа
        if (typeof val !== 'number' || isNaN(val)) continue;

        counts.totalScanned++;

        if (val > 0) {
          counts.inflow++;
        } else if (val < 0) {
          counts.outflow++;
        } else {
          // CMF ровно 0 (редко, но бывает при отсутствии объема/движения)
          counts.neutral++;
        }
      }
    }

    // Сортировка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      inflow: [] as number[],
      outflow: [] as number[],
      neutral: [] as number[], // Добавил для полноты картины (опционально)
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
      result.inflow.push(counts.inflow);
      result.outflow.push(counts.outflow);
      result.neutral.push(counts.neutral);
      result.totalScanned.push(counts.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No CMF Data (${tf})`,
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
            res += ` <span style="color:#666; font-size:10px">(n=${data.totalScanned[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            if (p.value > 0) {
              res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        data: ['Inflow (CMF > 0)', 'Outflow (CMF < 0)'],
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
        {
          name: 'Inflow (CMF > 0)',
          type: 'bar',
          stack: 'total',
          data: data.inflow,
          itemStyle: { color: '#00e676' }, // Зеленый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Outflow (CMF < 0)',
          type: 'bar',
          stack: 'total',
          data: data.outflow,
          itemStyle: { color: '#ff1744' }, // Красный
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
