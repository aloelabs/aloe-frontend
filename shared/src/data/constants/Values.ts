import { BigNumber } from 'ethers';
import { optimism } from 'viem/chains';
import { toBig } from '../../util/Numbers';

export const DEFAULT_CHAIN = optimism;
export const DEFAULT_ETHERSCAN_URL = 'https://etherscan.io';
export const Q32 = 0x100000000;

export const API_GEO_FENCING_URL = 'https://geo-fencing.aloe.capital/v1/verify';
export const API_SCREENING_URL = 'https://geo-fencing.aloe.capital/v1/screen';
export const API_PRICE_RELAY_LATEST_URL = 'https://api-price.aloe.capital/price-relay/v1/latest';
export const API_PRICE_RELAY_HISTORICAL_URL = 'https://api-price.aloe.capital/price-relay/v1/historical';
export const API_PRICE_RELAY_CONSOLIDATED_URL = 'https://api-price.aloe.capital/price-relay/v1/consolidated';
export const API_LEADERBOARD_URL = 'https://leaderboard.aloe.capital/v1/leaderboard';

export const NOTIFICATION_BOT_URL = 'https://t.me/aloe_notifier_bot';
export const TERMS_OF_SERVICE_URL = 'https://aloe.capital/legal/terms-of-service';
export const PRIVACY_POLICY_URL = 'https://aloe.capital/legal/privacy-policy';

export const LAUNCH_DATE = new Date('2024-01-02T06:00:00.000Z'); // 12 AM CST on Jan 2, 2024
export const DEAD_ADDRESS = '0xdead00000000000000000000000000000000dead';
export const ROUTER_TRANSMITTANCE = 9999;
export const ALOE_II_LIQUIDATION_INCENTIVE = 20;
export const ALOE_II_MAX_LEVERAGE = 200;
export const ALOE_II_LIQUIDATION_GRACE_PERIOD = 5 * 60;
export const Q96 = BigNumber.from('0x1000000000000000000000000');
export const BIGQ96 = toBig(Q96);
