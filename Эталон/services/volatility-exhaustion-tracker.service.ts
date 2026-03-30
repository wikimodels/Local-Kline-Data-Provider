import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
    providedIn: 'root',
})
export class VolatilityExhaustionTrackerService {
    public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
        const charts: Record<string, EChartsOption> = {};

        allMarketData.forEach((marketData, timeframe) => {
            const stats = this.calculateExhaustionStats(marketData);
            charts[timeframe] = this.buildChart(stats, timeframe);
        });

        return charts;
    }

    private calculateExhaustionStats(data: MarketData) {
        // Map: Time -> { exhaustion, highKurtosis, totalScanned }
        const timeMap = new Map<
            number,
            { exhaustion: number; highKurtosis: number; totalScanned: number }
        >();

        if (!data.data || data.data.length === 0) {
            return { dates: [], exhaustion: [], highKurtosis: [], totalScanned: [] };
        }

        for (const coin of data.data) {
            if (!coin.candles) continue;

            for (const c of coin.candles) {
                const time = c.openTime;

                if (!timeMap.has(time)) {
                    timeMap.set(time, { exhaustion: 0, highKurtosis: 0, totalScanned: 0 });
                }
                const counts = timeMap.get(time)!;

                const candle = c as any;

                // Проверяем наличие данных
                if (candle.kurtosis == null || isNaN(candle.kurtosis)) {
                    continue;
                }

                counts.totalScanned++;

                // Высокий Kurtosis (>5)
                if (candle.kurtosis > 5) {
                    counts.highKurtosis++;
                }

                // Volatility Exhaustion сигнал
                if (candle.isVolatilityExhaustion === true) {
                    counts.exhaustion++;
                }
            }
        }

        const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

        const result = {
            dates: [] as string[],
            exhaustion: [] as number[],
            highKurtosis: [] as number[],
            totalScanned: [] as number[],
        };

        const fmt = new Intl.DateTimeFormat('en-GB', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

        for (const t of sortedTimes) {
            const counts = timeMap.get(t)!;
            if (counts.totalScanned > 0) {
                result.dates.push(fmt.format(new Date(t)));
                result.exhaustion.push(counts.exhaustion);
                result.highKurtosis.push(counts.highKurtosis);
                result.totalScanned.push(counts.totalScanned);
            }
        }

        return result;
    }

    private buildChart(data: any, tf: string): EChartsOption {
        if (data.dates.length === 0) {
            return {
                title: {
                    text: `No Volatility Data (${tf})`,
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#666' },
                },
            };
        }

        return {
            backgroundColor: 'transparent',
            title: {
                text: `Volatility Exhaustion Tracker (${tf})`,
                left: 'center',
                top: 5,
                textStyle: { color: '#ccc', fontSize: 14 },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
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
                        res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
                    });
                    return res;
                },
            },
            legend: {
                data: ['High Kurtosis (>5)', 'Exhaustion Signals 💥'],
                top: 30,
                left: 'center',
                textStyle: { color: '#ccc', fontSize: 11 },
                icon: 'roundRect',
                itemGap: 15,
            },
            grid: { left: '3%', right: '3%', bottom: '5%', top: '15%', containLabel: true },
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
                    name: 'High Kurtosis Count',
                    position: 'left',
                    splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
                    axisLabel: { color: '#888' },
                },
                {
                    type: 'value',
                    name: 'Exhaustion Signals',
                    position: 'right',
                    splitLine: { show: false },
                    axisLabel: { color: '#888' },
                },
            ],
            series: [
                {
                    name: 'High Kurtosis (>5)',
                    type: 'line',
                    yAxisIndex: 0,
                    data: data.highKurtosis,
                    itemStyle: { color: '#ffd43b' }, // Жёлтый
                    areaStyle: { opacity: 0.2 },
                    smooth: true,
                    showSymbol: false,
                },
                {
                    name: 'Exhaustion Signals 💥',
                    type: 'bar',
                    yAxisIndex: 1,
                    data: data.exhaustion,
                    itemStyle: { color: '#ff6b6b' }, // Красный
                    emphasis: { focus: 'series' },
                },
            ],
        };
    }
}
