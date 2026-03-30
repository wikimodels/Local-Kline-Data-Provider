import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class EmaFanService {
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
    // Map: Time -> { bull, bear, mess, total }
    const timeMap = new Map<number, { bull: number; bear: number; mess: number; total: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], bull: [], bear: [], mess: [], total: [] };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Берем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const ca = c as any;
        const time = ca.openTime;

        // Валидация: Если любой из EMA отсутствует или <= 0 — пропускаем свечу.
        if (
          !ca.ema50 ||
          ca.ema50 <= 0 ||
          !ca.ema100 ||
          ca.ema100 <= 0 ||
          !ca.ema150 ||
          ca.ema150 <= 0
        ) {
          continue;
        }

        if (!timeMap.has(time)) {
          timeMap.set(time, { bull: 0, bear: 0, mess: 0, total: 0 });
        }

        const counts = timeMap.get(time)!;
        counts.total++; // Считаем живые монеты

        // Логика Веера
        const isBullFan = ca.ema50 > ca.ema100 && ca.ema100 > ca.ema150;
        const isBearFan = ca.ema50 < ca.ema100 && ca.ema100 < ca.ema150;

        if (isBullFan) {
          counts.bull++;
        } else if (isBearFan) {
          counts.bear++;
        } else {
          counts.mess++;
        }
      }
    }

    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      bull: [] as number[],
      bear: [] as number[],
      mess: [] as number[],
      total: [] as number[],
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
      result.bull.push(c.bull);
      result.bear.push(c.bear);
      result.mess.push(c.mess);
      result.total.push(c.total);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No EMA Fan Data (${tf})`,
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
          if (data.total && data.total[index]) {
            res += ` <span style="color:#666; font-size:10px">(n=${data.total[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Bullish Fan (50>100>150)', 'Mixed/Mess', 'Bearish Fan (50<100<150)'],
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
          name: 'Bullish Fan (50>100>150)',
          type: 'bar',
          stack: 'total',
          data: data.bull,
          itemStyle: { color: '#00e676' }, // Зеленый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Mixed/Mess',
          type: 'bar',
          stack: 'total',
          data: data.mess,
          itemStyle: { color: '#757575' }, // Серый
          emphasis: { focus: 'series' },
        },
        {
          name: 'Bearish Fan (50<100<150)',
          type: 'bar',
          stack: 'total',
          data: data.bear,
          itemStyle: { color: '#d50000' }, // Красный
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
