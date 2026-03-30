import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
  providedIn: 'root',
})
export class MarketRegimeService {
  public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
    console.log(`📈 [MarketRegimeService] getWidgetData called with ${allMarketData.size} timeframes:`,
      Array.from(allMarketData.keys()));

    const charts: Record<string, EChartsOption> = {};

    allMarketData.forEach((marketData, timeframe) => {
      console.log(`📈 [MarketRegimeService] Processing ${timeframe}, coins: ${marketData.data.length}`);
      const history = this.calculateHistorySeries(marketData);
      charts[timeframe] = this.buildHistoryChart(history, timeframe);
    });

    console.log(`📈 [MarketRegimeService] Generated charts for:`, Object.keys(charts));
    return charts;
  }

  private calculateHistorySeries(data: MarketData) {
    // Map: Time -> { la, sa, ll, sc, totalScanned }
    const timeMap = new Map<
      number,
      { la: number; sa: number; ll: number; sc: number; totalScanned: number }
    >();

    if (!data.data || data.data.length === 0)
      return { dates: [], la: [], sa: [], ll: [], sc: [], totalScanned: [] };

    for (const coin of data.data) {
      const candles = coin.candles;
      if (!candles) continue;

      for (const c of candles) {
        const time = c.openTime;
        let counts = timeMap.get(time);
        if (!counts) {
          counts = { la: 0, sa: 0, ll: 0, sc: 0, totalScanned: 0 };
          timeMap.set(time, counts);
        }

        // Используем готовые флаги из бэкенда (рассчитаны в pipeline)
        const candle = c as any;

        // Проверяем наличие хотя бы одного флага (если нет - пропускаем)
        if (
          candle.isLongAccumulation == null &&
          candle.isShortAccumulation == null &&
          candle.isLongLiquidation == null &&
          candle.isShortCovering == null
        ) {
          continue; // Нет данных OI для этой свечи
        }

        counts.totalScanned++;

        // Считаем монеты в каждом режиме
        if (candle.isLongAccumulation === true) counts.la++;
        if (candle.isShortAccumulation === true) counts.sa++;
        if (candle.isLongLiquidation === true) counts.ll++;
        if (candle.isShortCovering === true) counts.sc++;
      }
    }

    // Сортируем по времени
    const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

    const result = {
      dates: [] as string[],
      la: [] as number[],
      sa: [] as number[],
      ll: [] as number[],
      sc: [] as number[],
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
      result.la.push(c.la);
      result.sa.push(c.sa);
      result.ll.push(c.ll);
      result.sc.push(c.sc);
      result.totalScanned.push(c.totalScanned);
    }

    return result;
  }

  private buildHistoryChart(data: any, tf: string): EChartsOption {
    if (data.dates.length === 0) {
      return {
        title: {
          text: `No Valid History (${tf})`,
          subtext: 'Missing OI or Price Slopes',
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
        data: ['Long Acc', 'Short Acc', 'Long Liq', 'Short Cover'],
        top: 0,
        left: 'center',
        textStyle: { color: '#ccc', fontSize: 11 },
        icon: 'circle',
      },
      toolbox: {
        show: true,
        feature: { restore: { show: true, title: 'Reset Zoom' } },
        iconStyle: { borderColor: '#9090a0' },
        right: '5%',
        top: 0,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0],
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
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
      },
      series: [
        {
          name: 'Long Acc',
          type: 'line',
          smooth: true,
          showSymbol: false,
          stack: 'Total',
          areaStyle: { opacity: 0.3 },
          data: data.la,
          itemStyle: { color: '#00e676' },
          lineStyle: { width: 1 },
        },
        {
          name: 'Short Acc',
          type: 'line',
          smooth: true,
          showSymbol: false,
          stack: 'Total',
          areaStyle: { opacity: 0.3 },
          data: data.sa,
          itemStyle: { color: '#ff2a2a' },
          lineStyle: { width: 1 },
        },
        {
          name: 'Long Liq',
          type: 'line',
          smooth: true,
          showSymbol: false,
          stack: 'Total',
          areaStyle: { opacity: 0.3 },
          data: data.ll,
          itemStyle: { color: '#ff9100' },
          lineStyle: { width: 1 },
        },
        {
          name: 'Short Cover',
          type: 'line',
          smooth: true,
          showSymbol: false,
          stack: 'Total',
          areaStyle: { opacity: 0.3 },
          data: data.sc,
          itemStyle: { color: '#2979ff' },
          lineStyle: { width: 1 },
        },
      ],
    };
  }
}
