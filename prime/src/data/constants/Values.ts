import Big from 'big.js';
import { Q96 } from '../../util/Uniswap';

export const UINT256_MAX =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const BLOCKS_TO_WAIT = 1;
export const WETH_GAS_RESERVE = new Big('200000000000000000');
export const DEFAULT_RATIO_CHANGE = '5.0';
export const RATIO_CHANGE_CUTOFF = 0;
export const API_URL = 'https://api.aloe.capital';
export const GAS_ESTIMATION_SCALING = 1.1;
export const DEFAULT_ADD_LIQUIDITY_SLIPPAGE_PERCENTAGE = 0.5;
export const BIGQ96 = new Big(Q96.toString());
