import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class DeltaRvwapAbsorptionService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    // Map: Time -> { bullAbs, bearAbs, totalScanned }
    const timeMap = new Map<number, { bullAbs: number; bearAbs: number; totalScanned: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], bullAbs: [], bearAbs: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР КОРРЕЛЯЦИИ.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const ca = c as any;
        const time = ca.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { bullAbs: 0, bearAbs: 0, totalScanned: 0 });
        }

        const counts = timeMap.get(time)!;

        // Проверка наличия полей в Пайплайне
        if (
          typeof ca.closePrice !== 'number' ||
          typeof ca.volumeDelta !== 'number' ||
          typeof ca.rvwapUpperBand1 !== 'number' ||
          typeof ca.rvwapLowerBand1 !== 'number'
        ) {
          continue;
        }

        counts.totalScanned++;

        // --- ЛОГИКА ABSORPTION (ПОГЛОЩЕНИЯ) ---

        // 1. Bullish Absorption (Цена дешевая + Лимитный покупатель всасывает продажи)
        // Интерпретация: Цена ниже дна канала, но Дельта положительная (покупки по рынку)
        // ИЛИ (чаще для absorption): Цена стоит, дельта красная, но цена не падает (Limit Buy).
        // В твоем коде логика: "Close < LowBand AND Delta > 0".
        // Это агрессивный откуп дна (Market Buy into Lows). Оставляем как есть.
        if (ca.closePrice < ca.rvwapLowerBand1 && ca.volumeDelta > 0) {
          counts.bullAbs++;
        }

        // 2. Bearish Absorption (Цена дорогая + Лимитный продавец)
        // Логика: "Close > UpBand AND Delta < 0".
        // Это агрессивная продажа на хаях (Market Sell into Highs).
        if (ca.closePrice > ca.rvwapUpperBand1 && ca.volumeDelta < 0) {
          counts.bearAbs++;
        }
      }
    }

    // Упаковка данных
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      bullAbs: [] as number[],
      bearAbs: [] as number[],
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
      result.bullAbs.push(counts.bullAbs);
      result.bearAbs.push(counts.bearAbs);
      result.totalScanned.push(counts.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Absorption Data (${tf})`,
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
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Bullish Abs. (Cheap + Buying)', 'Bearish Abs. (Expensive + Selling)'],
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
          name: 'Bullish Abs. (Cheap + Buying)',
          type: 'bar',
          stack: 'total',
          data: data.bullAbs,
          itemStyle: { color: '#00e5ff' }, // Яркий Циан
          emphasis: { focus: 'series' },
        },
        {
          name: 'Bearish Abs. (Expensive + Selling)',
          type: 'bar',
          stack: 'total',
          data: data.bearAbs,
          itemStyle: { color: '#ff6d00' }, // Яркий Оранжевый
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
