import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class PatternRadarService {
  // 🔥 Удален CORR_THRESHOLD

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculatePatternStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculatePatternStats(data: MarketData) {
    // Map: Time -> { doji, hammer, pinbar, bullEng, bearEng, totalScanned }
    const timeMap = new Map<
      number,
      {
        doji: number;
        hammer: number;
        pinbar: number;
        bullEng: number;
        bearEng: number;
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        doji: [],
        hammer: [],
        pinbar: [],
        bullEng: [],
        bearEng: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // 1. УБРАН ФИЛЬТР ПО КОРРЕЛЯЦИИ. Сканируем все монеты.

      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        // Инициализируем счетчик
        if (!timeMap.has(time)) {
          timeMap.set(time, {
            doji: 0,
            hammer: 0,
            pinbar: 0,
            bullEng: 0,
            bearEng: 0,
            totalScanned: 0,
          });
        }

        const counts = timeMap.get(time)!;
        counts.totalScanned++;

        // 2. Считаем паттерны (флаги из пайплайна)
        if (!!(c as any).isDoji) counts.doji++;
        if (!!(c as any).isHammer) counts.hammer++;
        if (!!(c as any).isPinbar) counts.pinbar++;
        if (!!(c as any).isBullishEngulfing) counts.bullEng++;
        if (!!(c as any).isBearishEngulfing) counts.bearEng++;
      }
    }

    // 3. Сортируем и разворачиваем
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      doji: [] as number[],
      hammer: [] as number[],
      pinbar: [] as number[],
      bullEng: [] as number[],
      bearEng: [] as number[],
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
      result.doji.push(c.doji);
      result.hammer.push(c.hammer);
      result.pinbar.push(c.pinbar);
      result.bullEng.push(c.bullEng);
      result.bearEng.push(c.bearEng);
      result.totalScanned.push(c.totalScanned);
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Patterns Found (${tf})`,
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
        order: 'valueDesc',
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.totalScanned && data.totalScanned[index]) {
            res += ` <span style="color:#666; font-size:10px">(Scanned: ${data.totalScanned[index]})</span>`;
          }
          res += '<br/>';

          params.forEach((p: any) => {
            if (p.value > 0) {
              // Показываем только если есть паттерны
              res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        data: ['Doji', 'Hammer', 'Pinbar', 'Bull Engulfing', 'Bear Engulfing'],
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
        // 1. DOJI - Желтый
        {
          name: 'Doji',
          type: 'bar',
          stack: 'total',
          data: data.doji,
          itemStyle: { color: '#ffd740' },
          emphasis: { focus: 'series' },
        },
        // 2. HAMMER - Синий
        {
          name: 'Hammer',
          type: 'bar',
          stack: 'total',
          data: data.hammer,
          itemStyle: { color: '#2979ff' },
          emphasis: { focus: 'series' },
        },
        // 3. PINBAR - Фиолетовый
        {
          name: 'Pinbar',
          type: 'bar',
          stack: 'total',
          data: data.pinbar,
          itemStyle: { color: '#d500f9' },
          emphasis: { focus: 'series' },
        },
        // 4. BULL ENG - Зеленый
        {
          name: 'Bull Engulfing',
          type: 'bar',
          stack: 'total',
          data: data.bullEng,
          itemStyle: { color: '#00e676' },
          emphasis: { focus: 'series' },
        },
        // 5. BEAR ENG - Красный
        {
          name: 'Bear Engulfing',
          type: 'bar',
          stack: 'total',
          data: data.bearEng,
          itemStyle: { color: '#ff1744' },
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
