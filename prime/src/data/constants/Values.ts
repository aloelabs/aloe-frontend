import Big from 'big.js';
import { BigNumber } from 'ethers';
import { toBig } from 'shared/lib/util/Numbers';

export const UINT256_MAX = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const BLOCKS_TO_WAIT = 1;
export const WETH_GAS_RESERVE = new Big('200000000000000000');
export const DEFAULT_RATIO_CHANGE = '5.0';
export const RATIO_CHANGE_CUTOFF = 0;
export const API_URL = 'https://api.aloe.capital';
export const GAS_ESTIMATION_SCALING = 1.1;
export const DEFAULT_ADD_LIQUIDITY_SLIPPAGE_PERCENTAGE = 0.5;
export const DEFAULT_SLIPPAGE_PERCENTAGE = '0.50';
export const Q48 = BigNumber.from('0x1000000000000');
export const Q96 = BigNumber.from('0x1000000000000000000000000');
export const BIGQ96 = toBig(Q96);
export const MAX_UNISWAP_POSITIONS = 3;

export const ALOE_II_LIQUIDATION_INCENTIVE = 20;
export const ALOE_II_MAX_LEVERAGE = 200;
