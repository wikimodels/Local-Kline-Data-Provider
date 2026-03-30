import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class VolumeChurnService {
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
      { distribution: number; absorption: number; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0) {
      return { dates: [], distribution: [], absorption: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles || coin.candles.length < 20) continue;

      // Предрасчет среднего размера тела (ATR тела) для определения "узких" свечей
      const bodies = coin.candles.map((c) => Math.abs(c.closePrice - c.openPrice));
      const avgBody = this.calculateSMA(bodies, 20);

      for (let i = 20; i < coin.candles.length; i++) {
        const c = coin.candles[i];
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { distribution: 0, absorption: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        // Данные: Z-Score Объема, EMA для тренда
        if (c.volumeZScore == null || c.ema50 == null) continue;

        const volZ = Number(c.volumeZScore);
        const e50 = Number(c.ema50);
        const close = Number(c.closePrice);
        const bodySize = bodies[i];
        const averageBody = avgBody[i];

        if (isNaN(volZ) || isNaN(e50) || isNaN(averageBody)) continue;

        counts.totalScanned++;

        // --- ЛОГИКА CHURN (EFFORT vs RESULT) ---

        // 1. High Effort (Высокое Усилие): Аномальный объем
        const isHighVolume = volZ > 1.0; // Объем больше 1 сигмы

        // 2. Low Result (Низкий Результат): Свеча "зажата", тело меньше 60% от среднего
        const isSmallBody = bodySize < averageBody * 0.6;

        if (isHighVolume && isSmallBody) {
          // Определяем контекст: Дистрибуция или Накопление?

          // Если цена ВЫШЕ EMA 50 -> Мы на хаях -> Это Дистрибуция (Продажа в толпу)
          if (close > e50) {
            counts.distribution++;
          }
          // Если цена НИЖЕ EMA 50 -> Мы на дне -> Это Абсорбция (Выкуп страха)
          else {
            counts.absorption++;
          }
        }
      }
    }

    // Сортировка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      distribution: [] as number[],
      absorption: [] as number[],
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
        result.distribution.push(c.distribution); // Красные (Стоп роста)
        result.absorption.push(-c.absorption); // Зеленые (Стоп падения)
        result.totalScanned.push(c.totalScanned);
      }
    }

    return result;
  }

  // Простая SMA для массива чисел
  private calculateSMA(data: number[], period: number): number[] {
    const result = new Array(data.length).fill(NaN);
    if (data.length < period) return result;

    let sum = 0;
    // Первое окно
    for (let i = 0; i < period; i++) sum += data[i];
    result[period - 1] = sum / period;

    // Сдвиг окна
    for (let i = period; i < data.length; i++) {
      sum += data[i] - data[i - period];
      result[i] = sum / period;
    }
    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Churn Data (${tf})`,
          subtext: 'High Volume + Small Candle',
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
        formatter: (params: any) => {
          let res = `<b>${params[0].axisValue}</b>`;
          const index = params[0].dataIndex;
          if (data.totalScanned && data.totalScanned[index]) {
            res += ` <span style="color:#666; font-size:10px">(n=${data.totalScanned[index]})</span>`;
          }
          res += '<br/>';
          params.forEach((p: any) => {
            const val = Math.abs(p.value);
            if (val > 0) res += `${p.marker} ${p.seriesName}: <b>${val}</b><br/>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Distribution (Top Churn)', 'Absorption (Bottom Churn)'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
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
          name: 'Distribution (Top Churn)',
          type: 'bar',
          stack: 'total',
          data: data.distribution,
          // Яркий Оранжевый/Красный (Warn)
          itemStyle: { color: '#ff6d00' },
        },
        {
          name: 'Absorption (Bottom Churn)',
          type: 'bar',
          stack: 'total',
          data: data.absorption,
          // Глубокий бирюзовый (Support)
          itemStyle: { color: '#00e5ff' },
        },
      ],
    };
  }
}
