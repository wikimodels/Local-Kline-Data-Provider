import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
    providedIn: 'root',
})
export class MarketRegimeTransitionsService {
    public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
        const charts: Record<string, EChartsOption> = {};

        allMarketData.forEach((marketData, timeframe) => {
            const stats = this.calculateTransitionStats(marketData);
            charts[timeframe] = this.buildChart(stats, timeframe);
        });

        return charts;
    }

    private calculateTransitionStats(data: MarketData) {
        // Map: Time -> { trendingStart, meanRevStart, totalScanned }
        const timeMap = new Map<
            number,
            { trendingStart: number; meanRevStart: number; totalScanned: number }
        >();

        if (!data.data || data.data.length === 0) {
            return { dates: [], trendingStart: [], meanRevStart: [], totalScanned: [] };
        }

        let coinsWithData = 0;
        let coinsWithoutData = 0;

        for (const coin of data.data) {
            if (!coin.candles) continue;

            let hasAnyFlag = false;

            for (const c of coin.candles) {
                const time = c.openTime;

                if (!timeMap.has(time)) {
                    timeMap.set(time, { trendingStart: 0, meanRevStart: 0, totalScanned: 0 });
                }
                const counts = timeMap.get(time)!;

                // Используем готовые флаги из бэкенда
                const candle = c as any;

                // Проверяем наличие хотя бы одного флага
                if (
                    candle.isTrendingRegimeStart == null &&
                    candle.isMeanReversionRegimeStart == null
                ) {
                    continue;
                }

                hasAnyFlag = true;
                counts.totalScanned++;

                // Считаем монеты в каждом состоянии
                if (candle.isTrendingRegimeStart === true) counts.trendingStart++;
                if (candle.isMeanReversionRegimeStart === true) counts.meanRevStart++;
            }

            if (hasAnyFlag) {
                coinsWithData++;
            } else {
                coinsWithoutData++;
            }
        }


        const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

        const result = {
            dates: [] as string[],
            trendingStart: [] as number[],
            meanRevStart: [] as number[],
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
                result.trendingStart.push(counts.trendingStart);
                result.meanRevStart.push(counts.meanRevStart);
                result.totalScanned.push(counts.totalScanned);
            }
        }

        return result;
    }

    private buildChart(data: any, tf: string): EChartsOption {
        if (data.dates.length === 0) {
            return {
                title: {
                    text: `No Regime Transition Data (${tf})`,
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#666' },
                },
            };
        }

        return {
            backgroundColor: 'transparent',
            title: {
                text: `Market Regime Transitions (${tf})`,
                left: 'center',
                top: 5,
                textStyle: { color: '#ccc', fontSize: 14 },
            },
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
                        res += ` <span style="color:#666; font-size:10px">(Scanned: ${data.totalScanned[index]})</span>`;
                    }
                    res += '<br/>';

                    params.forEach((p: any) => {
                        if (p.value > 0) {
                            res += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`;
                        }
                    });
                    return res;
                },
            },
            legend: {
                data: ['Trending Regime Start 📈', 'Mean Reversion Start ↔️'],
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
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
                axisLabel: { color: '#888' },
                name: 'Coins Count',
            },
            series: [
                {
                    name: 'Trending Regime Start 📈',
                    type: 'bar',
                    stack: 'total',
                    data: data.trendingStart,
                    itemStyle: { color: '#51cf66' }, // Зелёный
                    emphasis: { focus: 'series' },
                },
                {
                    name: 'Mean Reversion Start ↔️',
                    type: 'bar',
                    stack: 'total',
                    data: data.meanRevStart,
                    itemStyle: { color: '#ff922b' }, // Оранжевый
                    emphasis: { focus: 'series' },
                },
            ],
        };
    }
}
