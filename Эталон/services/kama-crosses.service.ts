import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class KamaCrossesService {
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
    // Map: Time -> { up, down, totalScanned }
    const timeMap = new Map<number, { up: number; down: number; totalScanned: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], up: [], down: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { up: 0, down: 0, totalScanned: 0 });
        }

        const counts = timeMap.get(time)!;
        const ca = c as any;

        // Проверка наличия KAMA полей (достаточно одного)
        if (ca.isCrossedUpKama === undefined) continue;

        counts.totalScanned++;

        // 2. Считаем ПЕРЕСЕЧЕНИЯ (Events)
        if (!!ca.isCrossedUpKama) counts.up++;
        if (!!ca.isCrossedDownKama) counts.down++;
      }
    }

    // 3. Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      up: [] as number[],
      down: [] as number[],
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
      result.up.push(counts.up);
      result.down.push(counts.down);
      result.totalScanned.push(counts.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No KAMA Cross Data (${tf})`,
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
        data: ['Cross Up (KAMA Buy)', 'Cross Down (KAMA Sell)'],
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
        // UP CROSSES (Циан)
        {
          name: 'Cross Up (KAMA Buy)',
          type: 'bar',
          stack: 'total',
          data: data.up,
          itemStyle: { color: '#00b0ff' }, // Электрик голубой
          emphasis: { focus: 'series' },
        },
        // DOWN CROSSES (Оранжевый)
        {
          name: 'Cross Down (KAMA Sell)',
          type: 'bar',
          stack: 'total',
          data: data.down,
          itemStyle: { color: '#ff6d00' }, // Насыщенный оранжевый
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
