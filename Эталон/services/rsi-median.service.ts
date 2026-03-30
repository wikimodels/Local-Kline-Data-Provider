import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class RsiMedianService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateMedianStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateMedianStats(data: MarketData) {
    // Map: Time -> { rsi[], price[] }
    const timeMap = new Map<number, { rsi: number[]; price: number[] }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], rsi: [], price: [], counts: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const ca = c as any;

        const rsiVal = ca.rsi;
        const normClose = ca.closePriceNorm ?? ca.normalizedClose;

        // Пропускаем свечу только если RSI недоступен
        if (rsiVal === undefined || rsiVal === null || Number.isNaN(rsiVal)) continue;

        const time = ca.openTime;
        if (!timeMap.has(time)) {
          timeMap.set(time, { rsi: [], price: [] });
        }
        const entry = timeMap.get(time)!;
        entry.rsi.push(rsiVal);

        // normClose добавляем только если доступен (не блокирует RSI)
        if (normClose !== undefined && normClose !== null && !Number.isNaN(normClose)) {
          entry.price.push(normClose);
        }
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      rsi: [] as number[],
      price: [] as (number | null)[],  // null = нет данных → ECharts рисует разрыв
      counts: [] as number[],
    };

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const entry = timeMap.get(t)!;
      // Нужен кворум хотя бы 1 монета по RSI
      if (entry.rsi.length > 0) {
        result.dates.push(fmt.format(new Date(t)));
        result.rsi.push(this.getMedian(entry.rsi));
        // Если нет нормализованной цены — null (разрыв), но не 0
        result.price.push(entry.price.length > 0 ? this.getMedian(entry.price) : null);
        result.counts.push(entry.rsi.length);
      }
    }

    return result;
  }

  private getMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b); // копия — не мутируем оригинал
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return parseFloat(med.toFixed(2));
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No RSI Data (${tf})`,
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
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.counts && data.counts[index]) {
            res += ` <span style="color:#666; font-size:10px">(n=${data.counts[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Median RSI', 'Market Index'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 10 },
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '15%', containLabel: true },
      dataZoom: [{ type: 'inside', xAxisIndex: [0], start: 0, end: 100 }],
      xAxis: {
        type: 'category',
        data: data.dates,
        axisLine: { lineStyle: { color: '#444' } },
        axisLabel: { color: '#888' },
      },
      yAxis: [
        {
          type: 'value',
          min: 0,
          max: 100,
          position: 'left',
          splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
          axisLabel: { color: '#888' },
        },
        {
          type: 'value',
          scale: true,
          position: 'right',
          splitLine: { show: false },
          axisLabel: { show: false },
        },
      ],
      visualMap: {
        show: false,
        seriesIndex: 0,
        pieces: [
          { gt: 0, lte: 30, color: '#4caf50' }, // Oversold (Green)
          { gt: 30, lte: 70, color: '#b39ddb' }, // Neutral (Purple)
          { gt: 70, lte: 100, color: '#f44336' }, // Overbought (Red)
        ],
        outOfRange: { color: '#b39ddb' },
      },
      series: [
        {
          name: 'Median RSI',
          type: 'line',
          yAxisIndex: 0,
          data: data.rsi,
          smooth: true,
          lineStyle: { width: 2 },
          symbol: 'none',
          z: 10,
          markLine: {
            symbol: 'none',
            label: { show: false },
            lineStyle: { type: 'dashed', opacity: 0.3 },
            data: [
              { yAxis: 70, lineStyle: { color: '#f44336' } },
              { yAxis: 50, lineStyle: { color: '#666' } },
              { yAxis: 30, lineStyle: { color: '#4caf50' } },
            ],
          },
        },
        {
          name: 'Market Index',
          type: 'line',
          yAxisIndex: 1,
          data: data.price,
          smooth: true,
          showSymbol: false,
          connectNulls: false, // null → разрыв на графике, не ноль
          lineStyle: { width: 1.5, color: '#aaa', type: 'dashed', opacity: 0.6 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(255, 255, 255, 0.2)' },
                { offset: 1, color: 'rgba(255, 255, 255, 0.0)' },
              ],
            },
          },
          z: 1,
        },
      ],
    };
  }
}
