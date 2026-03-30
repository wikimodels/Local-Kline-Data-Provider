import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class EmaFanSlopeService {
  // 🔥 УДАЛЕН ФИЛЬТР CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    // Map: Time -> { bullPullback, bearBounce, totalScanned }
    const timeMap = new Map<
      number,
      { bullPullback: number; bearBounce: number; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], bullPullback: [], bearBounce: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Берем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const ca = c as any;
        const time = ca.openTime;

        // Инициализация счетчиков для времени
        if (!timeMap.has(time)) {
          timeMap.set(time, { bullPullback: 0, bearBounce: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        // Валидация: EMA 150 требует истории. Если её нет - пропускаем свечу.
        if (
          !ca.ema50 ||
          ca.ema50 <= 0 ||
          !ca.ema100 ||
          ca.ema100 <= 0 ||
          !ca.ema150 ||
          ca.ema150 <= 0 ||
          typeof ca.slopeEma50 !== 'number' ||
          typeof ca.slopeEma100 !== 'number' ||
          typeof ca.slopeEma150 !== 'number'
        ) {
          continue;
        }

        // Увеличиваем счетчик сканируемых монет
        counts.totalScanned++;

        // 1. Bullish Fan Structure (Веер вверх)
        const isBullFan = ca.ema50 > ca.ema100 && ca.ema100 > ca.ema150;
        // 2. Bearish Fan Structure (Веер вниз)
        const isBearFan = ca.ema50 < ca.ema100 && ca.ema100 < ca.ema150;

        // 3. Slopes Logic (Наклоны)
        const allSlopesDown = ca.slopeEma50 < 0 && ca.slopeEma100 < 0 && ca.slopeEma150 < 0;
        const allSlopesUp = ca.slopeEma50 > 0 && ca.slopeEma100 > 0 && ca.slopeEma150 > 0;

        // --- SCENARIO 1: Bullish Fan + Negative Slopes (Pullback / Коррекция к росту) ---
        if (isBullFan && allSlopesDown) {
          counts.bullPullback++;
        }

        // --- SCENARIO 2: Bearish Fan + Positive Slopes (Bounce / Отскок на падении) ---
        if (isBearFan && allSlopesUp) {
          counts.bearBounce++;
        }
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      bullPullback: [] as number[],
      bearBounce: [] as number[],
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
      result.bullPullback.push(c.bullPullback);
      result.bearBounce.push(c.bearBounce);
      result.totalScanned.push(c.totalScanned);
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
          let tooltip = `<b>${params[0].axisValue}</b><br/>`;
          const index = params[0].dataIndex;
          const totalScanned = data.totalScanned[index];

          params.forEach((p: any) => {
            tooltip += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });

          tooltip += `<span style="color:#666; font-size:11px; margin-top:5px; display:block">Scanned Coins: ${totalScanned}</span>`;
          return tooltip;
        },
      },
      legend: {
        data: ['Bullish Pullback (Fan UP, Slopes DOWN)', 'Bearish Bounce (Fan DOWN, Slopes UP)'],
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
        name: 'Signals Count',
      },
      series: [
        {
          name: 'Bullish Pullback (Fan UP, Slopes DOWN)',
          type: 'bar',
          stack: 'total',
          data: data.bullPullback,
          itemStyle: { color: '#00e5ff' }, // Циан
          emphasis: { focus: 'series' },
        },
        {
          name: 'Bearish Bounce (Fan DOWN, Slopes UP)',
          type: 'bar',
          stack: 'total',
          data: data.bearBounce,
          itemStyle: { color: '#ff9100' }, // Оранжевый
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
