import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class VolatilityAnomalyService {
  // 🔥 Удален CORR_THRESHOLD
  private readonly Z_WINDOW = 50;
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
    // Map: Time -> { vol, oi, buyers, sellers, totalScanned }
    const timeMap = new Map<
      number,
      {
        volCount: number;
        oiCount: number;
        buyersCount: number;
        sellersCount: number;
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], vol: [], oi: [], buyers: [], sellers: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ.

      if (!coin.candles || coin.candles.length < this.WARMUP) continue;

      // 2. Считаем Z-Score для bbWidth локально (т.к. его обычно нет в стриме)
      const bbWidthSeries = coin.candles.map((c) => {
        const val = (c as any).bbWidth;
        return typeof val === 'number' && !isNaN(val) ? val : NaN;
      });

      // Локальный расчет Z-Score для ширины Боллинджера
      const bbWidthZScores = this.calculateRollingZScore(bbWidthSeries, this.Z_WINDOW);

      // 3. Проходим по свечам
      for (let i = this.WARMUP; i < coin.candles.length; i++) {
        const c = coin.candles[i] as any;
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            volCount: 0,
            oiCount: 0,
            buyersCount: 0,
            sellersCount: 0,
            totalScanned: 0,
          });
        }
        const counts = timeMap.get(time)!;

        // Берем данные из Пайплайна и локального расчета
        const bbZ = bbWidthZScores[i];
        const oiZ = Number(c.openInterestZScore);
        const deltaZ = Number(c.volumeDeltaZScore);

        // Валидация
        if (isNaN(bbZ) || isNaN(oiZ) || isNaN(deltaZ)) continue;

        counts.totalScanned++;

        // --- ЛОГИКА 4-х ЛИНИЙ (ANOMALY DETECTION) ---

        // 1. Волатильность (Экшн) - BB расширяется аномально быстро
        if (bbZ > 0) counts.volCount++;

        // 2. Деньги (Топливо) - OI растет аномально
        if (oiZ > 0) counts.oiCount++;

        // 3. Покупатели (Быки) - Дельта аномально положительная
        if (deltaZ > 0) counts.buyersCount++;

        // 4. Продавцы (Медведи) - Дельта аномально отрицательная
        if (deltaZ < 0) counts.sellersCount++;
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      vol: [] as number[],
      oi: [] as number[],
      buyers: [] as number[],
      sellers: [] as number[],
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

      result.vol.push(c.volCount);
      result.oi.push(c.oiCount);
      result.buyers.push(c.buyersCount);
      result.sellers.push(c.sellersCount);
      result.totalScanned.push(c.totalScanned);
    }

    return result;
  }

  // Утилита для локального расчета (оставляем, т.к. BB Width Z-Score специфичен)
  private calculateRollingZScore(series: number[], window: number): number[] {
    const len = series.length;
    const zScores = new Array(len).fill(NaN);
    if (len < window) return zScores;

    for (let i = window - 1; i < len; i++) {
      const slice = series.slice(i - window + 1, i + 1);
      let sum = 0;
      let validCount = 0;
      for (const val of slice) {
        if (!isNaN(val)) {
          sum += val;
          validCount++;
        }
      }
      if (validCount < window * 0.8) {
        zScores[i] = NaN;
        continue;
      }

      const mean = sum / validCount;
      let sumSqDiff = 0;
      for (const val of slice) {
        if (!isNaN(val)) sumSqDiff += Math.pow(val - mean, 2);
      }
      const std = Math.sqrt(sumSqDiff / validCount);
      zScores[i] = std > 1e-9 ? (series[i] - mean) / std : 0;
    }
    return zScores;
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
        axisPointer: { type: 'line' },
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
        data: ['Volatility (Action)', 'Money Inflow (Fuel)', 'Buyers (Bulls)', 'Sellers (Bears)'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'circle',
        itemGap: 10,
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
          name: 'Volatility (Action)',
          type: 'line',
          data: data.vol,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, type: 'dashed', color: '#e040fb' }, // Фиолетовый пунктир
          itemStyle: { color: '#e040fb' },
          z: 1,
        },
        {
          name: 'Money Inflow (Fuel)',
          type: 'line',
          data: data.oi,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 3, color: '#ffd600' }, // Золотой
          itemStyle: { color: '#ffd600' },
          z: 2,
        },
        {
          name: 'Buyers (Bulls)',
          type: 'line',
          data: data.buyers,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, color: '#00e676' }, // Зеленый
          itemStyle: { color: '#00e676' },
          z: 3,
        },
        {
          name: 'Sellers (Bears)',
          type: 'line',
          data: data.sellers,
          showSymbol: false,
          smooth: true,
          lineStyle: { width: 2, color: '#ff1744' }, // Красный
          itemStyle: { color: '#ff1744' },
          z: 3,
        },
      ],
    };
  }
}
