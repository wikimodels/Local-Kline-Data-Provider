import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class RvwapCrossesService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateCrossStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateCrossStats(data: MarketData) {
    const timeMap = new Map<
      number,
      {
        // UP EVENTS
        upL2: number;
        upL1: number;
        upMain: number;
        upU1: number;
        upU2: number;
        // DOWN EVENTS
        downU2: number;
        downU1: number;
        downMain: number;
        downL1: number;
        downL2: number;
        // META
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        upL2: [],
        upL1: [],
        upMain: [],
        upU1: [],
        upU2: [],
        downU2: [],
        downU1: [],
        downMain: [],
        downL1: [],
        downL2: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            upL2: 0,
            upL1: 0,
            upMain: 0,
            upU1: 0,
            upU2: 0,
            downU2: 0,
            downU1: 0,
            downMain: 0,
            downL1: 0,
            downL2: 0,
            totalScanned: 0,
          });
        }

        const counts = timeMap.get(time)!;
        const ca = c as any;

        // Проверяем наличие данных RVWAP
        if (ca.isCrossedUpRvwap === undefined) continue;

        counts.totalScanned++;

        // --- UP EVENTS (Cross Up) ---
        if (ca.isCrossedUpRvwapLowerBand2) counts.upL2++;
        if (ca.isCrossedUpRvwapLowerBand1) counts.upL1++;
        if (ca.isCrossedUpRvwap) counts.upMain++;
        if (ca.isCrossedUpRvwapUpperBand1) counts.upU1++;
        if (ca.isCrossedUpRvwapUpperBand2) counts.upU2++;

        // --- DOWN EVENTS (Cross Down) ---
        if (ca.isCrossedDownRvwapUpperBand2) counts.downU2++;
        if (ca.isCrossedDownRvwapUpperBand1) counts.downU1++;
        if (ca.isCrossedDownRvwap) counts.downMain++;
        if (ca.isCrossedDownRvwapLowerBand1) counts.downL1++;
        if (ca.isCrossedDownRvwapLowerBand2) counts.downL2++;
      }
    }

    // Сортировка по времени
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      upL2: [] as number[],
      upL1: [] as number[],
      upMain: [] as number[],
      upU1: [] as number[],
      upU2: [] as number[],
      downU2: [] as number[],
      downU1: [] as number[],
      downMain: [] as number[],
      downL1: [] as number[],
      downL2: [] as number[],
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

      result.upL2.push(counts.upL2);
      result.upL1.push(counts.upL1);
      result.upMain.push(counts.upMain);
      result.upU1.push(counts.upU1);
      result.upU2.push(counts.upU2);

      result.downU2.push(counts.downU2);
      result.downU1.push(counts.downU1);
      result.downMain.push(counts.downMain);
      result.downL1.push(counts.downL1);
      result.downL2.push(counts.downL2);

      result.totalScanned.push(counts.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Data (${tf})`,
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
            if (p.value > 0) {
              res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        type: 'scroll',
        data: [
          'U. Band 2 Up',
          'U. Band 1 Up',
          'Basis Up',
          'L. Band 1 Up',
          'L. Band 2 Up',
          'U. Band 2 Down',
          'U. Band 1 Down',
          'Basis Down',
          'L. Band 1 Down',
          'L. Band 2 Down',
        ],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 10 },
        icon: 'circle',
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
        name: 'Events',
      },
      series: [
        // UP STACK
        {
          name: 'L. Band 2 Up',
          type: 'bar',
          stack: 'total',
          data: data.upL2,
          itemStyle: { color: '#43a047' },
        },
        {
          name: 'L. Band 1 Up',
          type: 'bar',
          stack: 'total',
          data: data.upL1,
          itemStyle: { color: '#66bb6a' },
        },
        {
          name: 'Basis Up',
          type: 'bar',
          stack: 'total',
          data: data.upMain,
          itemStyle: { color: '#1565c0' },
        },
        {
          name: 'U. Band 1 Up',
          type: 'bar',
          stack: 'total',
          data: data.upU1,
          itemStyle: { color: '#2979ff' },
        },
        {
          name: 'U. Band 2 Up',
          type: 'bar',
          stack: 'total',
          data: data.upU2,
          itemStyle: { color: '#00e5ff' },
        },

        // DOWN STACK
        {
          name: 'U. Band 2 Down',
          type: 'bar',
          stack: 'total',
          data: data.downU2,
          itemStyle: { color: '#fdd835' },
        },
        {
          name: 'U. Band 1 Down',
          type: 'bar',
          stack: 'total',
          data: data.downU1,
          itemStyle: { color: '#ffb300' },
        },
        {
          name: 'Basis Down',
          type: 'bar',
          stack: 'total',
          data: data.downMain,
          itemStyle: { color: '#c62828' },
        },
        {
          name: 'L. Band 1 Down',
          type: 'bar',
          stack: 'total',
          data: data.downL1,
          itemStyle: { color: '#e53935' },
        },
        {
          name: 'L. Band 2 Down',
          type: 'bar',
          stack: 'total',
          data: data.downL2,
          itemStyle: { color: '#d50000' },
        },
      ],
    };
  }
}
