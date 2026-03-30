import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class TrendRolloverService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    // Map: Time -> { rollover, recovery, totalScanned }
    const timeMap = new Map<number, { rollover: number; recovery: number; totalScanned: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], rollover: [], recovery: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { rollover: 0, recovery: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        // 1. Проверяем наличие EMA и наклонов (Slope)
        if (
          c.ema50 == null ||
          c.ema100 == null ||
          c.ema150 == null ||
          c.slopeEma50 == null ||
          c.slopeEma100 == null ||
          c.slopeEma150 == null
        ) {
          continue;
        }

        // Приводим к числам (на всякий случай)
        const e50 = Number(c.ema50);
        const e100 = Number(c.ema100);
        const e150 = Number(c.ema150);

        const s50 = Number(c.slopeEma50);
        const s100 = Number(c.slopeEma100);
        const s150 = Number(c.slopeEma150);

        if (isNaN(e50) || isNaN(e150) || isNaN(s50) || isNaN(s150)) continue;

        counts.totalScanned++;

        // --- ЛОГИКА ---

        // 1. Bearish Rollover (Закругление вниз)
        // Структура: Бычья (EMA 50 и 100 выше EMA 150)
        // Моментум: Медвежий (Все наклоны вниз)
        const isStructureBullish = e50 > e150 && e100 > e150;
        const isMomentumBearish = s50 < 0 && s100 < 0 && s150 < 0;

        if (isStructureBullish && isMomentumBearish) {
          counts.rollover++;
        }

        // 2. Bullish Recovery (Закругление вверх - для симметрии)
        // Структура: Медвежья (EMA 50 и 100 ниже EMA 150)
        // Моментум: Бычий (Все наклоны вверх)
        const isStructureBearish = e50 < e150 && e100 < e150;
        const isMomentumBullish = s50 > 0 && s100 > 0 && s150 > 0;

        if (isStructureBearish && isMomentumBullish) {
          counts.recovery++;
        }
      }
    }

    // Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      rollover: [] as number[],
      recovery: [] as number[],
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
        result.rollover.push(c.rollover);
        result.recovery.push(-c.recovery); // Вниз для графика
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
            res += ` <span style="color:#666; font-size:10px">(n=${data.totalScanned[index]})</span>`;
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
        data: ['Bearish Rollover (Weakness)', 'Bullish Recovery (Strength)'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'roundRect',
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
        name: 'Coins Count',
      },
      series: [
        {
          name: 'Bearish Rollover (Weakness)',
          type: 'bar',
          stack: 'total',
          data: data.rollover,
          // Ядовито-розовый/красный (Toxicity/Warning)
          itemStyle: { color: '#ff0055' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Bullish Recovery (Strength)',
          type: 'bar',
          stack: 'total',
          data: data.recovery,
          // Спокойный бирюзовый (Healing)
          itemStyle: { color: '#00bfa5' },
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
