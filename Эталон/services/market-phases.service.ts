import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData, Candle } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class MarketPhasesService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      charts[timeframe] = this.buildScatterChart(marketData, timeframe);
    });

    return charts;
  }

  private buildScatterChart(data: MarketData, tf: string): EChartsOption {
    if (!data.data || data.data.length === 0) {
      return { title: { text: 'No Data' } };
    }

    const seriesData: any[] = [];

    for (const coin of data.data) {
      // 1. Пропускаем совсем пустые
      if (!coin.candles || coin.candles.length < 2) continue;

      // 2. Ищем последнюю "живую" свечу с данными
      const validCandle = this.getLastValidCandle(coin.candles);

      // Если даже Z-Score не нашли — пропускаем
      if (!validCandle) continue;

      const zScore = validCandle.closePriceZScore!;

      // 🔥 ИСПРАВЛЕНИЕ: Берем entropy20, так как pipeline сохраняет именно так
      let entropy = (validCandle as any).entropy20;

      // Если по какой-то причине (старт сервера) данных нет, ставим 0.5, но это будет редкость
      if (typeof entropy !== 'number' || isNaN(entropy)) {
        entropy = 0.5;
      }

      // Дополнительная защита от бесконечностей
      if (!isFinite(zScore)) continue;

      seriesData.push({
        name: coin.symbol,
        value: [entropy, zScore], // X: Chaos, Y: Trend
        itemStyle: { color: this.getColor(zScore, entropy) },
      });
    }

    return {
      backgroundColor: 'transparent',
      title: {
        text: `Market Phases (${seriesData.length})`,
        left: 'center',
        top: 0,
        textStyle: { color: '#666', fontSize: 12 },
      },
      tooltip: {
        formatter: (params: any) => {
          return `<b>${params.name}</b><br/>Entropy: ${params.value[0].toFixed(2)}<br/>Z-Score: ${params.value[1].toFixed(2)}`;
        },
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
      },
      grid: { left: '5%', right: '5%', bottom: '10%', top: '10%', containLabel: true },
      xAxis: {
        name: 'Market Chaos (Entropy)',
        nameLocation: 'middle',
        nameGap: 25,
        type: 'value',
        min: 0,
        max: 1,
        splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
        axisLabel: { color: '#888' },
        axisLine: { lineStyle: { color: '#444' } },
      },
      yAxis: {
        name: 'Trend Strength (Z-Score)',
        nameLocation: 'middle',
        nameGap: 30,
        type: 'value',
        splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
        axisLabel: { color: '#888' },
        axisLine: { lineStyle: { color: '#444' } },
        scale: true,
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 8,
          data: seriesData,
          markLine: {
            silent: true,
            lineStyle: { color: '#555', type: 'dotted' },
            data: [{ xAxis: 0.65 }, { yAxis: 0 }],
          },
          markArea: {
            silent: true,
            itemStyle: { opacity: 0.1 },
            data: [
              // Структура (Слева)
              [{ coord: [0, -100] }, { coord: [0.65, 100], itemStyle: { color: '#00e676' } }],
              // Хаос (Справа)
              [{ coord: [0.65, -100] }, { coord: [1, 100], itemStyle: { color: '#ff1744' } }],
            ],
          },
        },
      ],
    };
  }

  // 🔥 РОБУСТНАЯ ВАЛИДАЦИЯ
  private getLastValidCandle(candles: Candle[]): any | null {
    // Ищем на 10 свечей назад. Главное — наличие Z-Score.
    for (let i = candles.length - 1; i >= Math.max(0, candles.length - 10); i--) {
      const c = candles[i] as any;
      if (
        c.closePriceZScore !== undefined &&
        c.closePriceZScore !== null &&
        !isNaN(c.closePriceZScore)
      ) {
        return c;
      }
    }
    return null;
  }

  private getColor(z: number, e: number): string {
    if (e > 0.75) return '#757575'; // Chaos = Grey
    if (z > 1.5) return '#00e676'; // Strong Uptrend
    if (z < -1.5) return '#ff1744'; // Strong Downtrend
    return '#ccc'; // Noise
  }
}
