import Big from 'big.js';
import { BigNumber } from 'ethers';
import { GN } from 'shared/lib/data/GoodNumber';
import { toBig } from 'shared/lib/util/Numbers';

export const UINT256_MAX = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
export const BLOCKS_TO_WAIT = 1;
export const WETH_GAS_RESERVE = new Big('200000000000000000');
export const DEFAULT_RATIO_CHANGE = '5.0';
export const RATIO_CHANGE_CUTOFF = 0;
export const API_URL = 'https://api.aloe.capital';
export const API_GEO_FENCING_URL = 'https://geo-fencing.aloe.capital/v1/verify';
export const GAS_ESTIMATION_SCALING = 1.1;
export const DEFAULT_ADD_LIQUIDITY_SLIPPAGE_PERCENTAGE = 0.5;
export const Q48 = BigNumber.from('0x1000000000000');
export const Q96 = BigNumber.from('0x1000000000000000000000000');
export const BIGQ96 = toBig(Q96);
export const MAX_UNISWAP_POSITIONS = 3;

export const ALOE_II_SIGMA_MIN = GN.fromDecimalString('0.01', 18);
export const ALOE_II_SIGMA_MAX = GN.fromDecimalString('0.18', 18);
export const ALOE_II_SIGMA_SCALER = 5;
export const ALOE_II_LIQUIDATION_INCENTIVE = 20;
export const ALOE_II_MAX_LEVERAGE = 200;
