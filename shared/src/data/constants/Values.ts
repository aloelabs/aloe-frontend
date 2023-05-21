import { BigNumber } from 'ethers';
import { chain } from 'wagmi';
import { toBig } from '../../util/Numbers';
import { GN } from '../GoodNumber';

export const DEFAULT_CHAIN = chain.optimism;
export const DEFAULT_ETHERSCAN_URL = 'https://etherscan.io';
export const Q48 = BigNumber.from('0x1000000000000');
export const Q96 = BigNumber.from('0x1000000000000000000000000');
export const BIGQ96 = toBig(Q96);

export const ALOE_II_SIGMA_MIN = GN.fromDecimalString('0.01', 18);
export const ALOE_II_SIGMA_MAX = GN.fromDecimalString('0.18', 18);
export const ALOE_II_SIGMA_SCALER = 5;
export const ALOE_II_LIQUIDATION_INCENTIVE = 20;
export const ALOE_II_MAX_LEVERAGE = 200;
