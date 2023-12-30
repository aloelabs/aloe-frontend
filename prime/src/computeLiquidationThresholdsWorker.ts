import { computeLiquidationThresholds } from './data/BalanceSheet';
import {
  ComputeLiquidationThresholdsRequest,
  parseMarginAccountParams,
  parseUniswapPositionParams,
} from './util/ComputeLiquidationThresholdUtils';

/* eslint-disable no-restricted-globals */
self.onmessage = (e: MessageEvent<ComputeLiquidationThresholdsRequest>) => {
  try {
    const request: ComputeLiquidationThresholdsRequest = e.data;
    const { marginAccountParams, uniswapPositionParams, iterations, precision } = request;
    const marginAccount = parseMarginAccountParams(marginAccountParams);
    const uniswapPositions = parseUniswapPositionParams(uniswapPositionParams);
    const liquidationThresholds = computeLiquidationThresholds(
      marginAccount.assets,
      marginAccount.liabilities,
      uniswapPositions,
      marginAccount.sqrtPriceX96,
      marginAccount.iv,
      marginAccount.nSigma,
      marginAccount.token0.decimals,
      marginAccount.token1.decimals,
      iterations,
      precision
    );
    self.postMessage(JSON.stringify(liquidationThresholds));
  } catch (e) {
    console.error(e);
  }
};

export {};
