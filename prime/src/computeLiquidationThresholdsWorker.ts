import { computeLiquidationThresholds } from './data/MarginAccount';
import {
  ComputeLiquidationThresholdsRequest,
  parseMarginAccountParams,
  parseUniswapPositionParams,
} from './util/ComputeLiquidationThresholdUtils';

/* eslint-disable no-restricted-globals */
self.onmessage = (e: MessageEvent<ComputeLiquidationThresholdsRequest>) => {
  try {
    const request: ComputeLiquidationThresholdsRequest = e.data;
    const { marginAccountParams, uniswapPositionParams, sigma, iterations, precision } = request;
    const marginAccount = parseMarginAccountParams(marginAccountParams);
    const uniswapPositions = parseUniswapPositionParams(uniswapPositionParams);
    const liquidationThresholds = computeLiquidationThresholds(
      marginAccount,
      uniswapPositions,
      sigma,
      iterations,
      precision
    );
    self.postMessage(JSON.stringify(liquidationThresholds));
  } catch (e) {
    console.error(e);
  }
};

export {};
