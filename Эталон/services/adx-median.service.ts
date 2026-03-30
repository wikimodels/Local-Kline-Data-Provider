import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class AdxMedianService {
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
    const timeMap = new Map<number, { adx: number[]; diPlus: number[]; diMinus: number[] }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], adx: [], diPlus: [], diMinus: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем весь рынок.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const ca = c as any;
        const time = ca.openTime;

        // 2. БЕРЕМ ГОТОВЫЕ ДАННЫЕ ИЗ PIPELINE
        // Проверяем валидность (ADX не должен быть NaN)
        if (
          typeof ca.adx !== 'number' ||
          Number.isNaN(ca.adx) ||
          typeof ca.diPlus !== 'number' ||
          Number.isNaN(ca.diPlus) ||
          typeof ca.diMinus !== 'number' ||
          Number.isNaN(ca.diMinus)
        ) {
          continue;
        }

        if (!timeMap.has(time)) {
          timeMap.set(time, { adx: [], diPlus: [], diMinus: [] });
        }

        const lists = timeMap.get(time)!;
        lists.adx.push(ca.adx);
        lists.diPlus.push(ca.diPlus);
        lists.diMinus.push(ca.diMinus);
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      adx: [] as number[],
      diPlus: [] as number[],
      diMinus: [] as number[],
      counts: [] as number[], // Добавим для отладки в тултип
    };

    const fmt = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const t of sortedTimes) {
      const lists = timeMap.get(t)!;

      // Рисуем, если есть данные хотя бы по 1 монете
      if (lists.adx.length > 0) {
        result.dates.push(fmt.format(new Date(t)));
        result.counts.push(lists.adx.length);

        // Медиана рынка
        result.adx.push(parseFloat(this.getMedian(lists.adx).toFixed(2)));
        result.diPlus.push(parseFloat(this.getMedian(lists.diPlus).toFixed(2)));
        result.diMinus.push(parseFloat(this.getMedian(lists.diMinus).toFixed(2)));
      }
    }

    return result;
  }

  private getMedian(values: number[]): number {
    if (values.length === 0) return 0;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    if (values.length % 2 !== 0) {
      return values[half];
    }
    return (values[half - 1] + values[half]) / 2.0;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No ADX Data (${tf})`,
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
        order: 'valueDesc',
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          // Добавляем инфо о кол-ве монет из первого элемента
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
        data: ['Median ADX', 'Median DI+', 'Median DI-'],
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
        name: 'Value',
      },
      series: [
        {
          name: 'Median ADX',
          type: 'line',
          data: data.adx,
          showSymbol: false,
          itemStyle: { color: '#ffffff' }, // Белый
          lineStyle: { width: 3 },
          markLine: {
            symbol: 'none',
            silent: true,
            data: [{ yAxis: 20 }],
            lineStyle: { color: 'rgba(255, 255, 255, 0.4)', type: 'dashed', width: 1 },
            label: { formatter: '20', color: '#666', fontSize: 10, position: 'end' },
          },
        },
        {
          name: 'Median DI+',
          type: 'line',
          data: data.diPlus,
          showSymbol: false,
          itemStyle: { color: '#00e676' }, // Зеленый
          lineStyle: { width: 2 },
          areaStyle: { color: 'rgba(0, 230, 118, 0.1)' },
        },
        {
          name: 'Median DI-',
          type: 'line',
          data: data.diMinus,
          showSymbol: false,
          itemStyle: { color: '#ff1744' }, // Красный
          lineStyle: { width: 2 },
          areaStyle: { color: 'rgba(255, 23, 68, 0.1)' },
        },
      ],
    };
  }
}
