// services/indicator-pipeline.ts
// Deno-адаптированная версия indicator pipeline (без Angular)

import { MarketData, PriceSeries, Candle, DColors } from "../models/types.ts";
import { logger } from "../core/utils/logger.ts";

// Import all calculation functions
import { calculateADX } from "../functions/calculations/adx.ts";
import { calculateBollingerBands } from "../functions/calculations/bollinger.ts";
import { calculateCMF } from "../functions/calculations/cmf.ts";
import { calculateEMA } from "../functions/calculations/ma.ts";
import { calculateMACD } from "../functions/calculations/macd.ts";
import { calculateOBV } from "../functions/calculations/obv.ts";
import { calculateRSI } from "../functions/calculations/rsi.ts";
import {
  calculateRVWAP,
  analyzeRvwapBands,
  analyzeRvwapCrosses,
} from "../functions/calculations/rvwap.ts";
import { calculateVZO } from "../functions/calculations/vzo.ts";
import { calculateZScore } from "../functions/calculations/z-score.ts";
import {
  calculateEntropy,
  calculateSignEntropy,
} from "../functions/calculations/entropy.ts";
import { calculateRollingHurst } from "../functions/calculations/hurst.ts";
import { calculateRollingKurtosis } from "../functions/calculations/kurtosis.ts";
import { calculateRollingSkewness } from "../functions/calculations/skewness.ts";
import { calculateSlope } from "../functions/calculations/slope.ts";
import { analyzeLineStates } from "../functions/calculations/states.ts";
import { calculateKAMA } from "../functions/calculations/kama.ts";
import { recognizeCandlePatterns } from "../functions/calculations/patterns.ts";
import {
  calculateLowestLow,
  calculateHighestHigh,
  calculatePriceNormalization,
} from "../functions/calculations/rolling-max-min.ts";
import { calculateEfficiencyRatio } from "../functions/calculations/efficiency.ts";
import { calculateAdxDensity } from "../functions/calculations/adx-density.ts";
import { calculateDiPlusDominance } from "../functions/calculations/di-dominance.ts";
import { calculateRollingNormalization } from "../functions/calculations/calculate-rolling-normalization.ts";
import { calculateEmaFan } from "../functions/calculations/fan.ts";
import { analyzeBreakouts } from "../functions/calculations/breakout.ts";

// Advanced analysis functions
import { analyzeRvwapRsiDivergence } from "../functions/calculations/rvwap-rsi-divergence.ts";
import { analyzeRvwapVzoDivergence } from "../functions/calculations/rvwap-vzo-divergence.ts";
import { analyzeRvwapCmfDivergence } from "../functions/calculations/rvwap-cmf-divergence.ts";
import { analyzeOrderFlowRegime } from "../functions/calculations/order-flow-regime.ts";
import { analyzeRvwapMomentumReversal } from "../functions/calculations/rvwap-momentum-reversal.ts";
import { analyzeCmfSlopeChange } from "../functions/calculations/cmf-slope-change.ts";
import { analyzeMarketRegimeChange } from "../functions/calculations/market-regime-change.ts";
import { analyzeVolatilityExhaustion } from "../functions/calculations/volatility-exhaustion.ts";
import { analyzeSkewReversal } from "../functions/calculations/skew-reversal.ts";

// Interface for candles with dynamic indicator fields
interface CandleWithIndicators extends Candle {
  [key: string]: any;
}

/**
 * Indicator Pipeline Service (Deno version)
 * Processes market data through all calculation functions
 */
export class IndicatorPipelineService {
  /**
   * Process market data through indicator pipeline
   */
  public async process(data: MarketData): Promise<MarketData> {
    logger.info(
      `[Pipeline] Processing ${data.data.length} coins for ${data.timeframe}`,
      DColors.cyan,
    );

    const BATCH_SIZE = 25; // Reduced from 50 to prevent OOM on large datasets
    const GC_PAUSE_MS = 150; // Increased pause for better GC

    for (
      let batchStart = 0;
      batchStart < data.data.length;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, data.data.length);
      const batch = data.data.slice(batchStart, batchEnd);

      for (const coin of batch) {
        const closePrices = coin.candles.map((c) => c.closePrice!);

        const priceSeries: PriceSeries = {
          openTime: coin.candles.map((c) => c.openTime),
          openPrice: coin.candles.map((c) => c.openPrice!),
          highPrice: coin.candles.map((c) => c.highPrice!),
          lowPrice: coin.candles.map((c) => c.lowPrice!),
          closePrice: closePrices,
          volume: coin.candles.map((c) => c.volume!),
          timeframe: data.timeframe,
          openInterest: coin.candles.map((c) => c.openInterest ?? NaN),
          fundingRate: coin.candles.map((c) => c.fundingRate ?? NaN),
          volumeDelta: coin.candles.map((c) => c.volumeDelta ?? NaN),
        };

        // --- 1. BASIC INDICATORS ---
        const ema50Values = calculateEMA(closePrices, 50);
        const ema100Values = calculateEMA(closePrices, 100);
        const ema150Values = calculateEMA(closePrices, 150);

        const normResult = calculatePriceNormalization(priceSeries, 50);

        const tfStr = data.timeframe as string;
        const shortHistoryWindow = tfStr === "D" || tfStr === "1d" ? 20 : 50;
        const volumeWindow = 50;

        const normVolume = calculateRollingNormalization(
          priceSeries.volume,
          volumeWindow,
        );
        const normVolumeDelta = calculateRollingNormalization(
          priceSeries.volumeDelta || [],
          volumeWindow,
        );
        const normOI = calculateRollingNormalization(
          priceSeries.openInterest || [],
          shortHistoryWindow,
        );
        const normFunding = calculateRollingNormalization(
          priceSeries.fundingRate || [],
          shortHistoryWindow,
        );

        const adxResult = calculateADX(priceSeries, 14);
        const bbResult = calculateBollingerBands(priceSeries, 20, 2.0);
        const cmfResult = calculateCMF(priceSeries, 20);
        const macdResult = calculateMACD(priceSeries, 12, 26, 9);
        const rsiResult = calculateRSI(priceSeries, 10);
        const obvResult = calculateOBV(priceSeries);

        // --- 2. RVWAP AND COMPONENTS ---
        const rVwwapResult = calculateRVWAP(priceSeries, [1.0, 2.0]);

        const rvwapBandsAnalysis = analyzeRvwapBands(
          closePrices,
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
          rVwwapResult["rvwap_upper_band_2"],
          rVwwapResult["rvwap_lower_band_2"],
        );

        const rvwapCrossAnalysis = analyzeRvwapCrosses(
          closePrices,
          rVwwapResult["rvwap"],
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
          rVwwapResult["rvwap_upper_band_2"],
          rVwwapResult["rvwap_lower_band_2"],
        );

        // --- 3. OTHER INDICATORS ---
        const kamaResult = calculateKAMA(priceSeries, 10, 2, 30);
        const patternResult = recognizeCandlePatterns(priceSeries);
        const lowestLowResult = calculateLowestLow(priceSeries, [50, 100]);
        const highestHighResult = calculateHighestHigh(priceSeries, [50, 100]);
        const vzoResult = calculateVZO(priceSeries);

        // --- 4. Z-SCORES ---
        const zScoreClose = calculateZScore(priceSeries.closePrice, 50);
        const zScoreVolume = calculateZScore(priceSeries.volume, 50);
        const zScoreVolDelta = calculateZScore(
          priceSeries.volumeDelta || [],
          50,
        );
        const zScoreFunding = calculateZScore(
          priceSeries.fundingRate || [],
          50,
        );
        const zScoreOI = calculateZScore(
          priceSeries.openInterest || [],
          shortHistoryWindow,
        );

        // --- 5. STATS & MATH ---
        const entropyResult20 = calculateEntropy(priceSeries, 20);
        const signEntropyResult20 = calculateSignEntropy(priceSeries, 20);
        const entropyResult50 = calculateEntropy(priceSeries, 50);
        const signEntropyResult50 = calculateSignEntropy(priceSeries, 50);

        const kurtosis100 = calculateRollingKurtosis(priceSeries, 100);

        const candleCount = coin.candles.length;
        let hurstWindow = 400;
        if (candleCount < 500) {
          hurstWindow = Math.max(Math.floor(candleCount * 0.6), 200);
        }

        const hurst = calculateRollingHurst(priceSeries, hurstWindow);
        const skewness50 = calculateRollingSkewness(priceSeries, 50);
        const er10 = calculateEfficiencyRatio(priceSeries, 10);
        const adxDensityResult = calculateAdxDensity(adxResult["adx"], 50, 25);
        const diDominanceResult = calculateDiPlusDominance(
          adxResult["di_plus"],
          adxResult["di_minus"],
          50,
        );

        // --- 6. SLOPES ---
        const slopePeriod = 5;
        const slopeEma50 = calculateSlope(ema50Values, slopePeriod);
        const slopeEma100 = calculateSlope(ema100Values, slopePeriod);
        const slopeEma150 = calculateSlope(ema150Values, slopePeriod);
        const slopeRvwap = calculateSlope(rVwwapResult["rvwap"], slopePeriod);
        const slopeZClose = calculateSlope(zScoreClose, slopePeriod);
        const slopeZVolume = calculateSlope(zScoreVolume, slopePeriod);
        const slopeZVolDelta = calculateSlope(zScoreVolDelta, slopePeriod);
        const slopeZoi = calculateSlope(zScoreOI, slopePeriod);
        const slopeZFunding = calculateSlope(zScoreFunding, slopePeriod);

        // --- 7. LINE STATES ---
        const statesKama = analyzeLineStates(
          priceSeries,
          kamaResult["kama"],
          "Kama",
        );
        const statesEma50 = analyzeLineStates(
          priceSeries,
          ema50Values,
          "Ema50",
        );
        const statesEma100 = analyzeLineStates(
          priceSeries,
          ema100Values,
          "Ema100",
        );
        const statesEma150 = analyzeLineStates(
          priceSeries,
          ema150Values,
          "Ema150",
        );

        const fanResult = calculateEmaFan(
          ema50Values,
          ema100Values,
          ema150Values,
          priceSeries.highPrice,
          priceSeries.lowPrice,
        );

        const breakout50 = analyzeBreakouts(
          closePrices,
          highestHighResult["highest50"],
          lowestLowResult["lowest50"],
          50,
        );

        const breakout100 = analyzeBreakouts(
          closePrices,
          highestHighResult["highest100"],
          lowestLowResult["lowest100"],
          100,
        );

        // --- ADVANCED ANALYSIS ---
        const rvwapRsiDivergence = analyzeRvwapRsiDivergence(
          closePrices,
          priceSeries.highPrice,
          priceSeries.lowPrice,
          rsiResult["rsi"],
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
          5,
        );

        const rvwapVzoDivergence = analyzeRvwapVzoDivergence(
          closePrices,
          priceSeries.highPrice,
          priceSeries.lowPrice,
          vzoResult["vzo"],
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
          5,
        );

        const rvwapCmfDivergence = analyzeRvwapCmfDivergence(
          closePrices,
          priceSeries.highPrice,
          priceSeries.lowPrice,
          cmfResult["cmf"],
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
          5,
        );

        const orderFlowRegime = analyzeOrderFlowRegime(
          slopeZClose,
          slopeZoi,
          0,
        );

        const momentumReversal = analyzeRvwapMomentumReversal(
          closePrices,
          macdResult["macd_histogram"],
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
        );

        const cmfSlopeChange = analyzeCmfSlopeChange(cmfResult["cmf"], 5);

        const regimeChange = analyzeMarketRegimeChange(hurst, er10, 0.4);

        const volExhaustion = analyzeVolatilityExhaustion(
          kurtosis100,
          hurst,
          er10,
          5,
          0.6,
        );

        const skewReversal = analyzeSkewReversal(
          closePrices,
          skewness50,
          rVwwapResult["rvwap_upper_band_1"],
          rVwwapResult["rvwap_lower_band_1"],
          1.5,
        );

        // --- 8. MAP TO CANDLES ---
        coin.candles.forEach((candle, index) => {
          const c = candle as CandleWithIndicators;

          // Normalized prices
          c["highPriceNorm"] = normResult.highPriceNorm[index];
          c["lowPriceNorm"] = normResult.lowPriceNorm[index];
          c["openPriceNorm"] = normResult.openPriceNorm[index];
          c["closePriceNorm"] = normResult.closePriceNorm[index];

          c["volumeNorm"] = normVolume[index];
          c["volumeDeltaNorm"] = normVolumeDelta[index];
          c["openInterestNorm"] = normOI[index];
          c["fundingRateNorm"] = normFunding[index];

          // EMAs
          c["ema50"] = ema50Values[index];
          c["ema100"] = ema100Values[index];
          c["ema150"] = ema150Values[index];

          // ADX
          c["adx"] = adxResult["adx"][index];
          c["diPlus"] = adxResult["di_plus"][index];
          c["diMinus"] = adxResult["di_minus"][index];
          c["adxDensity"] = adxDensityResult[index];
          c["diPlusDominance"] = diDominanceResult[index];

          // Bollinger Bands
          c["bbBasis"] = bbResult["bb_basis"][index];
          c["bbUpper"] = bbResult["bb_upper"][index];
          c["bbLower"] = bbResult["bb_lower"][index];
          c["bbWidth"] = bbResult["bb_width"][index];

          // CMF, MACD, RSI, OBV
          c["cmf"] = cmfResult["cmf"][index];
          c["macd"] = macdResult["macd"][index];
          c["macdSignal"] = macdResult["macd_signal"][index];
          c["macdHistogram"] = macdResult["macd_histogram"][index];
          c["rsi"] = rsiResult["rsi"][index];
          c["obv"] = obvResult["obv"][index];
          c["obvEma20"] = obvResult["obv_ema_20"][index];

          // RVWAP
          c["rvwap"] = rVwwapResult["rvwap"][index];
          c["rvwapUpperBand1"] = rVwwapResult["rvwap_upper_band_1"][index];
          c["rvwapUpperBand2"] = rVwwapResult["rvwap_upper_band_2"][index];
          c["rvwapLowerBand1"] = rVwwapResult["rvwap_lower_band_1"][index];
          c["rvwapLowerBand2"] = rVwwapResult["rvwap_lower_band_2"][index];
          c["rvwapWidth1"] = rVwwapResult["rvwap_width_1"][index];
          c["rvwapWidth2"] = rVwwapResult["rvwap_width_2"][index];

          // KAMA
          c["kama"] = kamaResult["kama"][index];

          // Patterns
          c["isDoji"] = patternResult["isDoji"][index];
          c["isBullishEngulfing"] = patternResult["isBullishEngulfing"][index];
          c["isBearishEngulfing"] = patternResult["isBearishEngulfing"][index];
          c["isHammer"] = patternResult["isHammer"][index];
          c["isPinbar"] = patternResult["isPinbar"][index];

          // Rolling Max/Min
          c["lowest50"] = lowestLowResult["lowest50"][index];
          c["lowest100"] = lowestLowResult["lowest100"][index];
          c["highest50"] = highestHighResult["highest50"][index];
          c["highest100"] = highestHighResult["highest100"][index];

          // VZO
          c["vzo"] = vzoResult["vzo"][index];

          // Z-Scores
          c["closePriceZScore"] = zScoreClose[index];
          c["volumeZScore"] = zScoreVolume[index];
          c["volumeDeltaZScore"] = zScoreVolDelta[index];
          c["fundingRateZScore"] = zScoreFunding[index];
          c["openInterestZScore"] = zScoreOI[index];

          // Entropy
          c["entropy20"] = entropyResult20;
          c["signEntropy20"] = signEntropyResult20;
          c["entropy50"] = entropyResult50;
          c["signEntropy50"] = signEntropyResult50;

          // Stats
          c["kurtosis100"] = kurtosis100[index];
          const hData = hurst[index];
          c["hurst"] = hData.value;
          c["hurstConf"] = hData.confidence;
          c["skewness50"] = skewness50[index];
          c["er10"] = er10[index];

          // Slopes
          c["slopeEma50"] = slopeEma50[index];
          c["slopeEma100"] = slopeEma100[index];
          c["slopeEma150"] = slopeEma150[index];
          c["slopeRvwap"] = slopeRvwap[index];
          c["slopeZClose"] = slopeZClose[index];
          c["slopeZVolume"] = slopeZVolume[index];
          c["slopeZVolumeDelta"] = slopeZVolDelta[index];
          c["slopeZOi"] = slopeZoi[index];
          c["slopeZFunding"] = slopeZFunding[index];

          // RVWAP Bands
          c["isBetweenRvwapBands"] =
            rvwapBandsAnalysis.isBetweenRvwapBands[index];
          c["isAboveRvwapUpperBand1"] =
            rvwapBandsAnalysis.isAboveRvwapUpperBand1[index];
          c["isAboveRvwapUpperBand2"] =
            rvwapBandsAnalysis.isAboveRvwapUpperBand2[index];
          c["isBelowRvwapLowerBand1"] =
            rvwapBandsAnalysis.isBelowRvwapLowerBand1[index];
          c["isBelowRvwapLowerBand2"] =
            rvwapBandsAnalysis.isBelowRvwapLowerBand2[index];

          // RVWAP Crosses
          c["isCrossedUpRvwap"] = rvwapCrossAnalysis.isCrossedUpRvwap[index];
          c["isCrossedDownRvwap"] =
            rvwapCrossAnalysis.isCrossedDownRvwap[index];
          c["isCrossedUpRvwapUpperBand1"] =
            rvwapCrossAnalysis.isCrossedUpRvwapUpperBand1[index];
          c["isCrossedDownRvwapUpperBand1"] =
            rvwapCrossAnalysis.isCrossedDownRvwapUpperBand1[index];
          c["isCrossedUpRvwapUpperBand2"] =
            rvwapCrossAnalysis.isCrossedUpRvwapUpperBand2[index];
          c["isCrossedDownRvwapUpperBand2"] =
            rvwapCrossAnalysis.isCrossedDownRvwapUpperBand2[index];
          c["isCrossedUpRvwapLowerBand1"] =
            rvwapCrossAnalysis.isCrossedUpRvwapLowerBand1[index];
          c["isCrossedDownRvwapLowerBand1"] =
            rvwapCrossAnalysis.isCrossedDownRvwapLowerBand1[index];
          c["isCrossedUpRvwapLowerBand2"] =
            rvwapCrossAnalysis.isCrossedUpRvwapLowerBand2[index];
          c["isCrossedDownRvwapLowerBand2"] =
            rvwapCrossAnalysis.isCrossedDownRvwapLowerBand2[index];

          // Line States
          c["isAboveKama"] = statesKama["isAboveKama"][index];
          c["isBelowKama"] = statesKama["isBelowKama"][index];
          c["isCrossedUpKama"] = statesKama["isCrossedUpKama"][index];
          c["isCrossedDownKama"] = statesKama["isCrossedDownKama"][index];

          c["isAboveEma50"] = statesEma50["isAboveEma50"][index];
          c["isBelowEma50"] = statesEma50["isBelowEma50"][index];
          c["isCrossedUpEma50"] = statesEma50["isCrossedUpEma50"][index];
          c["isCrossedDownEma50"] = statesEma50["isCrossedDownEma50"][index];

          c["isAboveEma100"] = statesEma100["isAboveEma100"][index];
          c["isBelowEma100"] = statesEma100["isBelowEma100"][index];
          c["isCrossedUpEma100"] = statesEma100["isCrossedUpEma100"][index];
          c["isCrossedDownEma100"] = statesEma100["isCrossedDownEma100"][index];

          c["isAboveEma150"] = statesEma150["isAboveEma150"][index];
          c["isBelowEma150"] = statesEma150["isBelowEma150"][index];
          c["isCrossedUpEma150"] = statesEma150["isCrossedUpEma150"][index];
          c["isCrossedDownEma150"] = statesEma150["isCrossedDownEma150"][index];

          // Fan
          c["isBullishFan"] = fanResult["isBullishFan"][index];
          c["isBearishFan"] = fanResult["isBearishFan"][index];
          c["isMessFan"] = fanResult["isMessFan"][index];
          c["isBullishPunch"] = fanResult["isBullishPunch"][index];
          c["isBearishPunch"] = fanResult["isBearishPunch"][index];

          // Breakouts
          c["isCrossedUpHighest50"] = breakout50["isCrossedUpHighest50"][index];
          c["isCrossedDownLowest50"] =
            breakout50["isCrossedDownLowest50"][index];
          c["isCrossedUpHighest100"] =
            breakout100["isCrossedUpHighest100"][index];
          c["isCrossedDownLowest100"] =
            breakout100["isCrossedDownLowest100"][index];

          // Divergences
          c["isBullishRvwapRsiDivergence"] =
            rvwapRsiDivergence["isBullishRvwapRsiDivergence"][index];
          c["isBearishRvwapRsiDivergence"] =
            rvwapRsiDivergence["isBearishRvwapRsiDivergence"][index];
          c["isBullishRvwapVzoDivergence"] =
            rvwapVzoDivergence["isBullishRvwapVzoDivergence"][index];
          c["isBearishRvwapVzoDivergence"] =
            rvwapVzoDivergence["isBearishRvwapVzoDivergence"][index];
          c["isBullishRvwapCmfDivergence"] =
            rvwapCmfDivergence["isBullishRvwapCmfDivergence"][index];
          c["isBearishRvwapCmfDivergence"] =
            rvwapCmfDivergence["isBearishRvwapCmfDivergence"][index];

          // Order Flow
          c["isLongAccumulation"] =
            orderFlowRegime["isLongAccumulation"][index];
          c["isShortAccumulation"] =
            orderFlowRegime["isShortAccumulation"][index];
          c["isLongLiquidation"] = orderFlowRegime["isLongLiquidation"][index];
          c["isShortCovering"] = orderFlowRegime["isShortCovering"][index];

          // Reversals
          c["isTopReversalRisk"] = momentumReversal["isTopReversalRisk"][index];
          c["isBottomReversalChance"] =
            momentumReversal["isBottomReversalChance"][index];

          // CMF Slope
          c["isCmfSlopeUp"] = cmfSlopeChange["isCmfSlopeUp"][index];
          c["isCmfSlopeDown"] = cmfSlopeChange["isCmfSlopeDown"][index];

          // Regime
          c["isTrendingRegimeStart"] =
            regimeChange["isTrendingRegimeStart"][index];
          c["isMeanReversionRegimeStart"] =
            regimeChange["isMeanReversionRegimeStart"][index];

          // Exhaustion
          c["isVolatilityExhaustion"] =
            volExhaustion["isVolatilityExhaustion"][index];

          // Skew Reversal
          c["isBullishSkewReversal"] =
            skewReversal["isBullishSkewReversal"][index];
          c["isBearishSkewReversal"] =
            skewReversal["isBearishSkewReversal"][index];
        });
      }

      // Allow GC to run between batches
      if (batchEnd < data.data.length) {
        await new Promise((resolve) => setTimeout(resolve, GC_PAUSE_MS));
      }
    }

    // Calculate unique coins for final log
    const uniqueSymbols = new Set(data.data.map((c) => c.symbol));

    logger.info(
      `[Pipeline] ✓ Processed ${uniqueSymbols.size} unique coins with indicators`,
      DColors.green,
    );

    return data;
  }
}

// Export singleton instance
export const indicatorPipeline = new IndicatorPipelineService();
