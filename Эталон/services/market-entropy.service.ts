import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class MarketEntropyService {
  // 🔥 Удален CORR_THRESHOLD
  private readonly WARMUP = 50;

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    // Map: Time -> { e20, e50, oi, delta, totalScanned }
    const timeMap = new Map<
      number,
      { e20: number[]; e50: number[]; oi: number[]; delta: number[]; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        median20: [],
        median50: [],
        medianOi: [],
        medianDelta: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ.

      if (!coin.candles || coin.candles.length < this.WARMUP) continue;

      // 2. Подготовка Энтропии (либо из пайплайна, либо считаем)
      let entropy20Series: number[] = [];
      let entropy50Series: number[] = [];

      // Проверяем, есть ли готовая энтропия в первой свече (после вармапа)
      // Если есть - используем массив из пайплайна (map), если нет - считаем Rolling
      const hasPipelineEntropy = (coin.candles[this.WARMUP] as any).entropy20 !== undefined;

      if (!hasPipelineEntropy) {
        const closePrices = coin.candles.map((c) => c.closePrice);
        entropy20Series = this.calculateRollingEntropy(closePrices, 20);
        entropy50Series = this.calculateRollingEntropy(closePrices, 50);
      }

      // 3. Сборка данных
      for (let i = this.WARMUP; i < coin.candles.length; i++) {
        const c = coin.candles[i] as any;
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { e20: [], e50: [], oi: [], delta: [], totalScanned: 0 });
        }
        const bucket = timeMap.get(time)!;

        // Энтропия: Приоритет Пайплайну -> Локальный расчет
        let e20 = hasPipelineEntropy ? c.entropy20 : entropy20Series[i];
        let e50 = hasPipelineEntropy ? c.entropy50 : entropy50Series[i]; // Предполагаем, что 50 тоже там

        // Если 50 нет в пайплайне, но 20 есть, придется считать 50 локально или забить.
        // Для надежности, если локальный расчет был - берем его.
        if (!hasPipelineEntropy) {
          e20 = entropy20Series[i];
          e50 = entropy50Series[i];
        }

        const oiZ = Number(c.openInterestZScore);
        const deltaZ = Number(c.volumeDeltaZScore);

        if (
          e20 === undefined ||
          Number.isNaN(e20) ||
          e50 === undefined ||
          Number.isNaN(e50) ||
          Number.isNaN(oiZ) ||
          Number.isNaN(deltaZ)
        ) {
          continue;
        }

        bucket.totalScanned++;
        bucket.e20.push(e20);
        bucket.e50.push(e50);
        bucket.oi.push(oiZ);
        bucket.delta.push(deltaZ);
      }
    }

    // 4. Расчет Медиан
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      median20: [] as number[],
      median50: [] as number[],
      medianOi: [] as number[],
      medianDelta: [] as number[],
      totalScanned: [] as number[],
    };

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const bucket = timeMap.get(t)!;
      // Нужен кворум хотя бы из 1 монеты (но лучше больше)
      if (bucket.e20.length < 1) continue;

      result.dates.push(fmt.format(new Date(t)));

      result.median20.push(this.getMedian(bucket.e20));
      result.median50.push(this.getMedian(bucket.e50));
      result.medianOi.push(this.getMedian(bucket.oi));
      result.medianDelta.push(this.getMedian(bucket.delta));
      result.totalScanned.push(bucket.totalScanned);
    }

    return result;
  }

  // Локальный расчет энтропии (fallback)
  private calculateRollingEntropy(prices: number[], window: number): number[] {
    const len = prices.length;
    const entropy = new Array(len).fill(NaN);
    if (len < window + 1) return entropy;
    const returns = new Array(len).fill(0);
    for (let i = 1; i < len; i++) {
      returns[i] = Math.log(prices[i] / prices[i - 1]);
    }
    const numBins = 10;
    const maxEntropy = Math.log(numBins);
    for (let i = window; i < len; i++) {
      const slice = returns.slice(i - window + 1, i + 1);
      let min = Infinity,
        max = -Infinity;
      for (const val of slice) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
      if (Math.abs(max - min) < 1e-9) {
        entropy[i] = 0;
        continue;
      }
      const bins = new Array(numBins).fill(0);
      const binSize = (max - min) / numBins;
      for (const val of slice) {
        let binIndex = Math.floor((val - min) / binSize);
        if (binIndex >= numBins) binIndex = numBins - 1;
        bins[binIndex]++;
      }
      let H = 0;
      for (const count of bins) {
        if (count > 0) {
          const p = count / window;
          H -= p * Math.log(p);
        }
      }
      entropy[i] = H / maxEntropy;
    }
    return entropy;
  }

  private getMedian(values: number[]): number {
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    if (values.length % 2) return values[half];
    return (values[half - 1] + values[half]) / 2.0;
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
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.totalScanned && data.totalScanned[index]) {
            res += ` <span style="color:#666; font-size:10px">(n=${data.totalScanned[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            const val = p.value;
            res += `${p.marker} ${p.seriesName}: <b>${val?.toFixed(3)}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: [
          'Entropy 20 (Fast)',
          'Entropy 50 (Slow)',
          'Median OI (Money)',
          'Median Delta (Aggr)',
        ],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'circle',
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '12%', containLabel: true },
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
          max: 1,
          name: 'Chaos (Entropy)',
          position: 'left',
          splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
          axisLabel: { color: '#888' },
          axisLine: { lineStyle: { color: '#00e676' } },
        },
        {
          type: 'value',
          name: 'Z-Score (Money)',
          position: 'right',
          splitLine: { show: false },
          axisLabel: { color: '#ffd600' },
          axisLine: { lineStyle: { color: '#ffd600' } },
        },
      ],
      series: [
        {
          name: 'Entropy 20 (Fast)',
          type: 'line',
          yAxisIndex: 0,
          data: data.median20,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, color: '#00e676' },
          itemStyle: { color: '#00e676' },
          markArea: {
            silent: true,
            itemStyle: { opacity: 0.1 },
            data: [
              [{ yAxis: 0, itemStyle: { color: '#00e676' } }, { yAxis: 0.65 }],
              [{ yAxis: 0.85, itemStyle: { color: '#ff1744' } }, { yAxis: 1 }],
            ],
          },
        },
        {
          name: 'Entropy 50 (Slow)',
          type: 'line',
          yAxisIndex: 0,
          data: data.median50,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, type: 'dashed', color: '#2979ff' },
          itemStyle: { color: '#2979ff' },
        },
        {
          name: 'Median OI (Money)',
          type: 'line',
          yAxisIndex: 1,
          data: data.medianOi,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, color: '#ffd600' },
          itemStyle: { color: '#ffd600' },
        },
        {
          name: 'Median Delta (Aggr)',
          type: 'line',
          yAxisIndex: 1,
          data: data.medianDelta,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 1, color: '#e040fb' },
          itemStyle: { color: '#e040fb' },
          areaStyle: { opacity: 0.1, color: '#e040fb' },
        },
      ],
    };
  }
}
