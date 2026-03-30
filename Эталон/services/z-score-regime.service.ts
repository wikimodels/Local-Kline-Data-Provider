import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class ZScoreRegimeService {
  // 🔥 Удален CORR_THRESHOLD
  private readonly Z_THRESHOLD = 2.0; // Порог аномалии

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
        // > 2
        priceUp: number;
        volUp: number;
        deltaUp: number;
        oiUp: number;
        fundUp: number;
        // < -2
        priceDown: number;
        volDown: number;
        deltaDown: number;
        oiDown: number;
        fundDown: number;

        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        priceUp: [],
        volUp: [],
        deltaUp: [],
        oiUp: [],
        fundUp: [],
        priceDown: [],
        volDown: [],
        deltaDown: [],
        oiDown: [],
        fundDown: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const ca = c as any;
        const time = ca.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            priceUp: 0,
            volUp: 0,
            deltaUp: 0,
            oiUp: 0,
            fundUp: 0,
            priceDown: 0,
            volDown: 0,
            deltaDown: 0,
            oiDown: 0,
            fundDown: 0,
            totalScanned: 0,
          });
        }

        const counts = timeMap.get(time)!;

        // Проверяем наличие хотя бы Z-Score цены, чтобы считать свечу валидной
        if (typeof ca.closePriceZScore !== 'number') continue;

        counts.totalScanned++;

        // --- 1. PRICE Z-SCORE ---
        if (ca.closePriceZScore > this.Z_THRESHOLD) counts.priceUp++;
        if (ca.closePriceZScore < -this.Z_THRESHOLD) counts.priceDown++;

        // --- 2. VOLUME Z-SCORE ---
        if (typeof ca.volumeZScore === 'number') {
          if (ca.volumeZScore > this.Z_THRESHOLD) counts.volUp++;
          if (ca.volumeZScore < -this.Z_THRESHOLD) counts.volDown++;
        }

        // --- 3. VOLUME DELTA Z-SCORE ---
        if (typeof ca.volumeDeltaZScore === 'number') {
          if (ca.volumeDeltaZScore > this.Z_THRESHOLD) counts.deltaUp++;
          if (ca.volumeDeltaZScore < -this.Z_THRESHOLD) counts.deltaDown++;
        }

        // --- 4. OPEN INTEREST Z-SCORE ---
        if (typeof ca.openInterestZScore === 'number') {
          if (ca.openInterestZScore > this.Z_THRESHOLD) counts.oiUp++;
          if (ca.openInterestZScore < -this.Z_THRESHOLD) counts.oiDown++;
        }

        // --- 5. FUNDING RATE Z-SCORE ---
        if (typeof ca.fundingRateZScore === 'number') {
          if (ca.fundingRateZScore > this.Z_THRESHOLD) counts.fundUp++;
          if (ca.fundingRateZScore < -this.Z_THRESHOLD) counts.fundDown++;
        }
      }
    }

    // Упаковка данных
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      priceUp: [] as number[],
      volUp: [] as number[],
      deltaUp: [] as number[],
      oiUp: [] as number[],
      fundUp: [] as number[],
      priceDown: [] as number[],
      volDown: [] as number[],
      deltaDown: [] as number[],
      oiDown: [] as number[],
      fundDown: [] as number[],
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

      // UP (> 2)
      result.priceUp.push(c.priceUp);
      result.volUp.push(c.volUp);
      result.deltaUp.push(c.deltaUp);
      result.oiUp.push(c.oiUp);
      result.fundUp.push(c.fundUp);

      // DOWN (< -2) - отрицательные значения для графика
      result.priceDown.push(-c.priceDown);
      result.volDown.push(-c.volDown);
      result.deltaDown.push(-c.deltaDown);
      result.oiDown.push(-c.oiDown);
      result.fundDown.push(-c.fundDown);

      result.totalScanned.push(c.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Z-Score Data (${tf})`,
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
            const rawVal = p.value;
            if (rawVal === 0) return; // Пропускаем нули

            const absVal = Math.abs(rawVal);
            const type = rawVal > 0 ? 'High' : 'Low';

            res += `${p.marker} ${p.seriesName} (${type}): <b>${absVal}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Price', 'Volume', 'Delta', 'OI', 'Funding'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'circle',
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
        name: 'Anomalies (>2σ / <-2σ)',
      },
      series: [
        // --- UP STACK (> 2) ---
        {
          name: 'Price',
          type: 'bar',
          stack: 'up',
          data: data.priceUp,
          itemStyle: { color: '#00e676' },
        },
        {
          name: 'Volume',
          type: 'bar',
          stack: 'up',
          data: data.volUp,
          itemStyle: { color: '#2979ff' },
        },
        {
          name: 'Delta',
          type: 'bar',
          stack: 'up',
          data: data.deltaUp,
          itemStyle: { color: '#ffea00' },
        },
        { name: 'OI', type: 'bar', stack: 'up', data: data.oiUp, itemStyle: { color: '#ff9100' } },
        {
          name: 'Funding',
          type: 'bar',
          stack: 'up',
          data: data.fundUp,
          itemStyle: { color: '#d500f9' },
        },

        // --- DOWN STACK (< -2) ---
        {
          name: 'Price',
          type: 'bar',
          stack: 'down',
          data: data.priceDown,
          itemStyle: { color: '#00e676', opacity: 0.6 },
          legendHoverLink: true,
        },
        {
          name: 'Volume',
          type: 'bar',
          stack: 'down',
          data: data.volDown,
          itemStyle: { color: '#2979ff', opacity: 0.6 },
          legendHoverLink: true,
        },
        {
          name: 'Delta',
          type: 'bar',
          stack: 'down',
          data: data.deltaDown,
          itemStyle: { color: '#ffea00', opacity: 0.6 },
          legendHoverLink: true,
        },
        {
          name: 'OI',
          type: 'bar',
          stack: 'down',
          data: data.oiDown,
          itemStyle: { color: '#ff9100', opacity: 0.6 },
          legendHoverLink: true,
        },
        {
          name: 'Funding',
          type: 'bar',
          stack: 'down',
          data: data.fundDown,
          itemStyle: { color: '#d500f9', opacity: 0.6 },
          legendHoverLink: true,
        },
      ],
    };
  }
}
