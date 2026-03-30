import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class EmaCrossesService {
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
    // 6 метрик событий (Crosses Only) + TotalScanned
    const timeMap = new Map<
      number,
      {
        up50: number;
        up100: number;
        up150: number;
        down50: number;
        down100: number;
        down150: number;
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        up50: [],
        up100: [],
        up150: [],
        down50: [],
        down100: [],
        down150: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            up50: 0,
            up100: 0,
            up150: 0,
            down50: 0,
            down100: 0,
            down150: 0,
            totalScanned: 0,
          });
        }

        const counts = timeMap.get(time)!;
        const ca = c as any;

        // Проверяем, есть ли данные по пересечениям в принципе (не undefined)
        if (ca.isCrossedUpEma50 === undefined) continue;

        counts.totalScanned++;

        // 2. Считаем ПЕРЕСЕЧЕНИЯ (Events)
        if (!!ca.isCrossedUpEma50) counts.up50++;
        if (!!ca.isCrossedUpEma100) counts.up100++;
        if (!!ca.isCrossedUpEma150) counts.up150++;

        if (!!ca.isCrossedDownEma50) counts.down50++;
        if (!!ca.isCrossedDownEma100) counts.down100++;
        if (!!ca.isCrossedDownEma150) counts.down150++;
      }
    }

    // 3. Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result: any = { dates: [] };
    const keys = ['up50', 'up100', 'up150', 'down50', 'down100', 'down150', 'totalScanned'];
    keys.forEach((k) => (result[k] = []));

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const counts = timeMap.get(t)! as any;
      result.dates.push(fmt.format(new Date(t)));
      keys.forEach((k) => result[k].push(counts[k]));
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Cross Data (${tf})`,
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
        data: [
          'Breakout 150 (Major)',
          'Breakout 100',
          'Breakout 50 (Minor)',
          'Breakdown 150 (Major)',
          'Breakdown 100',
          'Breakdown 50 (Minor)',
        ],
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
        // UP CROSSES (Синий градиент)
        {
          name: 'Breakout 150 (Major)',
          type: 'bar',
          stack: 'total',
          data: data.up150,
          itemStyle: { color: '#2962ff' }, // Глубокий синий
          emphasis: { focus: 'series' },
        },
        {
          name: 'Breakout 100',
          type: 'bar',
          stack: 'total',
          data: data.up100,
          itemStyle: { color: '#00b0ff' }, // Голубой
          emphasis: { focus: 'series' },
        },
        {
          name: 'Breakout 50 (Minor)',
          type: 'bar',
          stack: 'total',
          data: data.up50,
          itemStyle: { color: '#80d8ff' }, // Светлый циан
          emphasis: { focus: 'series' },
        },

        // DOWN CROSSES (Оранжевый градиент)
        {
          name: 'Breakdown 150 (Major)',
          type: 'bar',
          stack: 'total',
          data: data.down150,
          itemStyle: { color: '#bf360c' }, // Темный Бордовый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Breakdown 100',
          type: 'bar',
          stack: 'total',
          data: data.down100,
          itemStyle: { color: '#ff6d00' }, // Оранжевый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Breakdown 50 (Minor)',
          type: 'bar',
          stack: 'total',
          data: data.down50,
          itemStyle: { color: '#ffab40' }, // Светлый оранжевый
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
