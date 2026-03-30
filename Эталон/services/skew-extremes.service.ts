import { Injectable } from '@angular/core';
import { EChartsOption } from 'echarts';
import { MarketData } from '../../models/kline.model';

@Injectable({
    providedIn: 'root',
})
export class SkewExtremesService {
    public getWidgetData(allMarketData: Map<string, MarketData>): Record<string, EChartsOption> {
        const charts: Record<string, EChartsOption> = {};

        allMarketData.forEach((marketData, timeframe) => {
            const stats = this.calculateSkewStats(marketData);
            charts[timeframe] = this.buildChart(stats, timeframe);
        });

        return charts;
    }

    private calculateSkewStats(data: MarketData) {
        // Map: Time -> { bullishRev, bearishRev, extremePositive, extremeNegative, totalScanned }
        const timeMap = new Map<
            number,
            {
                bullishRev: number;
                bearishRev: number;
                extremePositive: number;
                extremeNegative: number;
                totalScanned: number;
            }
        >();

        if (!data.data || data.data.length === 0) {
            return {
                dates: [],
                bullishRev: [],
                bearishRev: [],
                extremePositive: [],
                extremeNegative: [],
                totalScanned: [],
            };
        }

        for (const coin of data.data) {
            if (!coin.candles) continue;

            for (const c of coin.candles) {
                const time = c.openTime;

                if (!timeMap.has(time)) {
                    timeMap.set(time, {
                        bullishRev: 0,
                        bearishRev: 0,
                        extremePositive: 0,
                        extremeNegative: 0,
                        totalScanned: 0,
                    });
                }
                const counts = timeMap.get(time)!;

                const candle = c as any;

                // Проверяем наличие данных
                if (candle.skewness == null || isNaN(candle.skewness)) {
                    continue;
                }

                counts.totalScanned++;

                // Экстремальные значения
                if (candle.skewness > 1.5) {
                    counts.extremePositive++;
                } else if (candle.skewness < -1.5) {
                    counts.extremeNegative++;
                }

                // Reversal сигналы
                if (candle.isBullishSkewReversal === true) {
                    counts.bullishRev++;
                }
                if (candle.isBearishSkewReversal === true) {
                    counts.bearishRev++;
                }
            }
        }

        const sortedTimes = Array.from(timeMap.keys()).sort((a, b) => a - b);

        const result = {
            dates: [] as string[],
            bullishRev: [] as number[],
            bearishRev: [] as number[],
            extremePositive: [] as number[],
            extremeNegative: [] as number[],
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
                result.bullishRev.push(counts.bullishRev);
                result.bearishRev.push(counts.bearishRev);
                result.extremePositive.push(counts.extremePositive);
                result.extremeNegative.push(-counts.extremeNegative); // Отрицательные для графика
                result.totalScanned.push(counts.totalScanned);
            }
        }

        return result;
    }

    private buildChart(data: any, tf: string): EChartsOption {
        if (data.dates.length === 0) {
            return {
                title: {
                    text: `No Skewness Data (${tf})`,
                    left: 'center',
                    top: 'center',
                    textStyle: { color: '#666' },
                },
            };
        }

        return {
            backgroundColor: 'transparent',
            title: {
                text: `Skewness Extremes & Reversals (${tf})`,
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
                data: [
                    'Extreme Positive (>1.5)',
                    'Extreme Negative (<-1.5)',
                    'Bullish Reversal ⬆️',
                    'Bearish Reversal ⬇️',
                ],
                top: 30,
                left: 'center',
                textStyle: { color: '#ccc', fontSize: 10 },
                icon: 'roundRect',
                itemGap: 10,
            },
            grid: { left: '3%', right: '3%', bottom: '5%', top: '18%', containLabel: true },
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
                    name: 'Extreme Positive (>1.5)',
                    type: 'bar',
                    stack: 'extremes',
                    data: data.extremePositive,
                    itemStyle: { color: '#fab005' }, // Жёлтый
                    emphasis: { focus: 'series' },
                },
                {
                    name: 'Extreme Negative (<-1.5)',
                    type: 'bar',
                    stack: 'extremes',
                    data: data.extremeNegative,
                    itemStyle: { color: '#ae3ec9' }, // Фиолетовый
                    emphasis: { focus: 'series' },
                },
                {
                    name: 'Bullish Reversal ⬆️',
                    type: 'line',
                    data: data.bullishRev,
                    itemStyle: { color: '#51cf66' }, // Зелёный
                    lineStyle: { width: 2 },
                    symbol: 'circle',
                    symbolSize: 6,
                    z: 10,
                },
                {
                    name: 'Bearish Reversal ⬇️',
                    type: 'line',
                    data: data.bearishRev,
                    itemStyle: { color: '#ff6b6b' }, // Красный
                    lineStyle: { width: 2 },
                    symbol: 'circle',
                    symbolSize: 6,
                    z: 10,
                },
            ],
        };
    }
}
