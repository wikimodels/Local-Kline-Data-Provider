import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class EntropyStrategiesService {
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
    const timeMap = new Map<
      number,
      {
        squeeze: number;
        pump: number;
        dump: number;
        reversal: number;
        chaos: number;
        totalScanned: number;
      }
    >();

    if (!data.data || data.data.length === 0) {
      return {
        dates: [],
        squeeze: [],
        pump: [],
        dump: [],
        reversal: [],
        chaos: [],
        totalScanned: [],
      };
    }

    for (const coin of data.data) {
      // Проверка длины истории
      if (!coin.candles || coin.candles.length < this.WARMUP) continue;

      // 1. Расчет Z-Score для BB Width локально (т.к. его нет в пайплайне)
      const bbWidths = coin.candles.map((c: any) => c.bbWidth ?? NaN);
      const bbZScores = this.calculateRollingZScore(bbWidths, 50);

      for (let i = this.WARMUP; i < coin.candles.length; i++) {
        const c = coin.candles[i] as any;
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, {
            squeeze: 0,
            pump: 0,
            dump: 0,
            reversal: 0,
            chaos: 0,
            totalScanned: 0,
          });
        }
        const counts = timeMap.get(time)!;

        // Валидация данных из пайплайна
        // Проверяем наличие критически важных метрик
        if (
          c.entropy20 === undefined ||
          c.closePriceZScore === undefined ||
          c.openInterestZScore === undefined
        ) {
          continue;
        }

        counts.totalScanned++;

        const ent = c.entropy20;
        const priceZ = c.closePriceZScore;
        const bbZ = bbZScores[i] ?? 0;
        const oiZ = Number(c.openInterestZScore ?? 0);
        const deltaZ = Number(c.volumeDeltaZScore ?? 0);
        const slopeZOi = Number(c.slopeZOi ?? 0);

        const isPinbar = !!c.isPinbar;
        const isBearishPunch = !!c.isBearishPunch;

        // --- ЛОГИКА СТРАТЕГИЙ ---
        let categoryFound = false;

        // 1. 🔵 SQUEEZE (Сжатие волатильности + накопление OI + низкая энтропия)
        if (bbZ < -0.5 && ent < 0.6 && oiZ > 0.5) {
          counts.squeeze++;
          categoryFound = true;
        }

        // 2. 🟣 SMART REVERSION SHORT (Перекупленность + слабость тренда + триггер)
        if (!categoryFound) {
          const isOverbought = priceZ > 2.0;
          const isWeakness = ent > 0.75 || slopeZOi < -0.5;
          const isTrigger = isPinbar || isBearishPunch || deltaZ < -0.5;

          if (isOverbought && isWeakness && isTrigger) {
            counts.reversal++;
            categoryFound = true;
          }
        }

        // 3. 🟢 CLEAN PUMP (Рост цены + низкая энтропия + приток объема)
        if (!categoryFound && priceZ > 1.5 && ent < 0.75 && deltaZ > 0) {
          counts.pump++;
          categoryFound = true;
        }

        // 4. 🔴 CLEAN DUMP (Падение цены + низкая энтропия + отток объема)
        if (!categoryFound && priceZ < -1.5 && ent < 0.75 && deltaZ < 0) {
          counts.dump++;
          categoryFound = true;
        }

        // 5. 💀 CHAOS (Сильное движение, но высокая энтропия = риск)
        if (!categoryFound && Math.abs(priceZ) > 1.5 && ent >= 0.75) {
          counts.chaos++;
        }
      }
    }

    // Сортировка и упаковка данных
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      squeeze: [] as number[],
      pump: [] as number[],
      dump: [] as number[],
      reversal: [] as number[],
      chaos: [] as number[],
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
      result.squeeze.push(c.squeeze);
      result.pump.push(c.pump);
      result.dump.push(c.dump);
      result.reversal.push(c.reversal);
      result.chaos.push(c.chaos);
      result.totalScanned.push(c.totalScanned);
    }
    return result;
  }

  // Простой расчет Z-Score для массива
  private calculateRollingZScore(data: number[], window: number): number[] {
    const res = new Array(data.length).fill(NaN);
    if (data.length < window) return res;

    for (let i = window - 1; i < data.length; i++) {
      const slice = data.slice(i - window + 1, i + 1);
      const validSlice = slice.filter((v) => !isNaN(v));

      if (validSlice.length < window * 0.8) {
        res[i] = NaN;
        continue;
      }

      const mean = validSlice.reduce((a, b) => a + b, 0) / validSlice.length;
      const variance =
        validSlice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validSlice.length;
      const std = Math.sqrt(variance);

      res[i] = std === 0 ? 0 : (data[i] - mean) / std;
    }
    return res;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) return { title: { text: `No Strategy Data` } };

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
            // Игнорируем фоновые серии в тултипе, если они 0, но хаос часто не 0
            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Clean Pumps', 'Clean Dumps', 'Reversal Short', 'Squeezes', 'Chaos (Background)'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 10 },
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
      yAxis: [
        {
          type: 'value',
          name: 'Signals',
          position: 'left',
          splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
          axisLabel: { color: '#888' },
        },
        {
          type: 'value',
          name: 'Chaos',
          position: 'right',
          splitLine: { show: false },
          axisLabel: { color: '#424242' },
          axisLine: { show: false },
        },
      ],
      series: [
        {
          name: 'Clean Pumps',
          type: 'line',
          yAxisIndex: 0,
          data: data.pump,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#00e676' },
          itemStyle: { color: '#00e676' },
        },
        {
          name: 'Clean Dumps',
          type: 'line',
          yAxisIndex: 0,
          data: data.dump,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#ff1744' },
          itemStyle: { color: '#ff1744' },
          areaStyle: { opacity: 0.1, color: '#ff1744' },
        },
        {
          name: 'Reversal Short',
          type: 'line',
          yAxisIndex: 0,
          data: data.reversal,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#d500f9' },
          itemStyle: { color: '#d500f9' },
        },
        {
          name: 'Squeezes',
          type: 'line',
          yAxisIndex: 0,
          data: data.squeeze,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: '#00bcd4' },
          itemStyle: { color: '#00bcd4' },
        },
        {
          name: 'Chaos (Background)',
          type: 'line',
          yAxisIndex: 1,
          data: data.chaos,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 0 },
          itemStyle: { color: '#424242' },
          areaStyle: { opacity: 0.15, color: '#424242' },
          z: 0,
        },
      ],
    };
  }
}
