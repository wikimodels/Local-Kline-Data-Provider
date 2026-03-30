import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
    providedIn: 'root',
})
export class RvwapRsiDivergenceService {

    public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
        const charts: Record<string, EChartsOption> = {};

        allMarketData.forEach((marketData, timeframe) => {
            const stats = this.calculateStats(marketData);
            charts[timeframe] = this.buildChart(stats, timeframe);
        });

        return charts;
    }

    private calculateStats(data: MarketData) {
        // Map: openTime -> { bearDiv, bullDiv, totalScanned }
        const timeMap = new Map<number, { bearDiv: number; bullDiv: number; totalScanned: number }>();

        if (!data.data || data.data.length === 0) {
            return { dates: [], bearDiv: [], bullDiv: [], totalScanned: [] };
        }

        for (const coin of data.data) {
            if (!coin.candles) continue;

            for (const c of coin.candles) {
                const time = c.openTime;

                if (!timeMap.has(time)) {
                    timeMap.set(time, { bearDiv: 0, bullDiv: 0, totalScanned: 0 });
                }

                const counts = timeMap.get(time)!;
                const candle = c as any;

                // Проверяем наличие флагов из пайплайна
                if (
                    candle.isBullishRvwapRsiDivergence === undefined &&
                    candle.isBearishRvwapRsiDivergence === undefined
                ) {
                    continue;
                }

                counts.totalScanned++;

                // Читаем готовые флаги из пайплайна (calculations/rvwap-rsi-divergence.ts)
                if (candle.isBearishRvwapRsiDivergence === true) counts.bearDiv++;
                if (candle.isBullishRvwapRsiDivergence === true) counts.bullDiv++;
            }
        }

        const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);
        const result = {
            dates: [] as string[],
            bearDiv: [] as number[],
            bullDiv: [] as number[],
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
                result.bearDiv.push(c.bearDiv);
                result.bullDiv.push(-c.bullDiv); // Отрицательные — вниз на графике
                result.totalScanned.push(c.totalScanned);
            }
        }
        return result;
    }

    private buildChart(data: any, tf: string): EChartsOption {
        if (data.dates.length === 0) {
            return {
                title: {
                    text: `No Data (${tf})`,
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
                        res += ` <span style="color:#aaa; font-size:10px">(n=${data.totalScanned[index]})</span>`;
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
                data: ['Bearish Slope Div (Price↗ RSI↘)', 'Bullish Slope Div (Price↘ RSI↗)'],
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
                name: 'Coins',
            },
            series: [
                {
                    name: 'Bearish Slope Div (Price↗ RSI↘)',
                    type: 'bar',
                    stack: 'total',
                    data: data.bearDiv,
                    itemStyle: { color: '#ff1744' },
                },
                {
                    name: 'Bullish Slope Div (Price↘ RSI↗)',
                    type: 'bar',
                    stack: 'total',
                    data: data.bullDiv,
                    itemStyle: { color: '#00e676' },
                },
            ],
        };
    }
}
