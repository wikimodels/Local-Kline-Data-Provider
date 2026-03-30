import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData, Candle } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class MarketGravityService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};
    allMarketData.forEach((marketData, timeframe) => {
      charts[timeframe] = this.buildBarChart(marketData, timeframe);
    });
    return charts;
  }

  private buildBarChart(data: MarketData, tf: string): EChartsOption {
    if (!data.data || data.data.length === 0) return { title: { text: 'No Data' } };

    // 1. Собираем данные
    const items: { name: string; zScore: number; entropy: number }[] = [];

    for (const coin of data.data) {
      if (!coin.candles || coin.candles.length < 50) continue;

      // Валидация: ищем живую свечу
      const validCandle = this.getLastValidCandle(coin.candles);
      if (!validCandle) continue;

      const zScore = validCandle.closePriceZScore!;

      // Берём entropy20 — именно так назван ключ в пайплайне
      let entropy = validCandle.entropy20;
      if (typeof entropy !== 'number' || isNaN(entropy)) {
        entropy = 0;
      }

      items.push({ name: coin.symbol, zScore, entropy });
    }

    // 2. Сортируем: Top Gravity
    items.sort((a, b) => {
      const scoreA = Math.abs(a.zScore) * (1 - a.entropy);
      const scoreB = Math.abs(b.zScore) * (1 - b.entropy);
      return scoreB - scoreA; // Descending
    });

    const allItems = items;

    const categoryData = allItems.map((i) => i.name);
    const valueData = allItems.map((i) => ({
      value: i.zScore,
      itemStyle: {
        color: i.zScore > 0 ? '#00e676' : '#ff1744',
        opacity: Math.max(0.1, 1 - i.entropy),
      },
    }));

    return {
      backgroundColor: 'transparent',
      title: {
        text: `Market Gravity (${allItems.length})`,
        left: 'center',
        top: 0,
        textStyle: { color: '#666', fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const p = params[0];
          const item = allItems[p.dataIndex];
          if (!item) return '';
          return `<b>${p.name}</b><br/>Z-Score: ${p.value.toFixed(2)}<br/>Entropy: ${item.entropy.toFixed(2)}`;
        },
      },
      // Слайдер для прокрутки
      dataZoom: [
        {
          type: 'slider',
          yAxisIndex: 0,
          width: 20,
          right: 0,
          start: 0,
          end: 20,
          borderColor: '#333',
          fillerColor: 'rgba(100, 100, 100, 0.2)',
          handleStyle: { color: '#666' },
          textStyle: { color: '#888' },
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      grid: { left: 5, right: 30, bottom: 0, top: 20, containLabel: false }, // containLabel false, т.к. текст скрыт
      xAxis: { type: 'value', show: false },
      yAxis: {
        type: 'category',
        data: categoryData,
        // 🔥 СКРЫВАЕМ НАЗВАНИЯ МОНЕТ
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        inverse: true,
      },
      series: [{ type: 'bar', data: valueData, barWidth: '95%', label: { show: false } }],
    };
  }

  private getLastValidCandle(candles: Candle[]): any | null {
    for (let i = candles.length - 1; i >= Math.max(0, candles.length - 5); i--) {
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
}
