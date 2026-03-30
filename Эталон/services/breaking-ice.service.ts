import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class BreakingIceService {
  // 🔥 Без фильтра корреляции, сканируем весь рынок
  // EMA требуют предысторию, но в пайплайне они уже рассчитаны

  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      const stats = this.calculateStats(marketData);
      charts[timeframe] = this.buildChart(stats, timeframe);
    });

    return charts;
  }

  private calculateStats(data: MarketData) {
    // Map: Time -> { bull, bear, totalScanned }
    const timeMap = new Map<number, { bull: number; bear: number; totalScanned: number }>();

    if (!data.data || data.data.length === 0) {
      return { dates: [], bull: [], bear: [], totalScanned: [] };
    }

    for (const coin of data.data) {
      if (!coin.candles) continue;

      for (const c of coin.candles) {
        const time = c.openTime;

        if (!timeMap.has(time)) {
          timeMap.set(time, { bull: 0, bear: 0, totalScanned: 0 });
        }
        const counts = timeMap.get(time)!;

        // 1. Проверяем наличие EMA и Цены
        if (
          c.ema50 === undefined ||
          c.ema50 === null ||
          c.ema100 === undefined ||
          c.ema100 === null ||
          c.ema150 === undefined ||
          c.ema150 === null
        ) {
          continue;
        }

        const close = Number(c.closePrice);
        const e50 = Number(c.ema50);
        const e100 = Number(c.ema100);
        const e150 = Number(c.ema150);

        if (isNaN(close) || isNaN(e50) || isNaN(e100) || isNaN(e150)) continue;

        counts.totalScanned++;

        // --- ЛОГИКА BREAKING ICE ---

        // 1. Bullish Structure (Fan Up)
        const isFanUp = e50 > e100 && e100 > e150;

        // 2. Bearish Structure (Fan Down)
        const isFanDown = e50 < e100 && e100 < e150;

        // СИГНАЛЫ: Пробой "Льда" (EMA 150) против тренда

        // Тренд вверх, но цена упала под EMA 150 (Глубокая скидка)
        if (isFanUp && close < e150) {
          counts.bull++;
        }

        // Тренд вниз, но цена выросла над EMA 150 (Снятие стопов шортистов)
        if (isFanDown && close > e150) {
          counts.bear++;
        }
      }
    }

    // Сортировка и упаковка
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      bull: [] as number[],
      bear: [] as number[],
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
      // Рисуем точку, только если были данные
      if (c.totalScanned > 0) {
        result.dates.push(fmt.format(new Date(t)));
        result.bull.push(c.bull);
        result.bear.push(-c.bear); // Отрицательные для графика вниз
        result.totalScanned.push(c.totalScanned);
      }
    }

    return result;
  }

  private buildChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Breaking Ice Data (${tf})`,
          subtext: 'Requires EMA 50/100/150 history',
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
            if (val > 0) {
              res += `${p.marker} ${p.seriesName}: <b>${val}</b><br/>`;
            }
          });
          return res;
        },
      },
      legend: {
        data: ['Bullish Ice Break (Buy Dip)', 'Bearish Ice Break (Sell Rally)'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'roundRect',
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
          name: 'Bullish Ice Break (Buy Dip)',
          type: 'bar',
          stack: 'total',
          data: data.bull,
          // Яркий сине-голубой (Ice/Water) или зеленый. Возьмем Cyan для "Ice".
          itemStyle: { color: '#00e5ff' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Bearish Ice Break (Sell Rally)',
          type: 'bar',
          stack: 'total',
          data: data.bear,
          // Оранжево-красный (Fire/Danger)
          itemStyle: { color: '#ff3d00' },
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
