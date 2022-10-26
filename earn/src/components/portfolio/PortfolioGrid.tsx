import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { GetTokenData, TokenData } from '../../data/TokenData';
import { TokenBalance, TokenQuote } from '../../pages/PortfolioPage';
import { formatTokenAmount, roundPercentage } from '../../util/Numbers';
import PortfolioPieChartWidget, { TokenPercentage } from './PortfolioPieChartWidget';
import PortfolioPriceChartWidget from './PriceChart';

const STATUS_GREEN = 'rgba(0, 196, 140, 1)';
const STATUS_GREEN_LIGHT = 'rgba(0, 196, 140, 0.75)';
const STATUS_RED = '#FF4D4F';
const STATUS_RED_LIGHT = 'rgba(255, 77, 79, 0.75)';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 0.75fr 1fr;
  grid-template-rows: 1fr 1fr 1fr 1fr;
  grid-template-areas:
    'pie balance price'
    'pie balance price'
    'pie apy price'
    'pie apy uptime';
  grid-gap: 24px;
  height: 260px;
`;

const BaseGridItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
`;

const PieChartContainer = styled(BaseGridItem)`
  grid-area: pie;
`;

const BalanceContainer = styled(BaseGridItem)`
  grid-area: balance;
`;

const APYContainer = styled(BaseGridItem)`
  grid-area: apy;
`;

const PriceContainer = styled(BaseGridItem)`
  grid-area: price;
`;

const UptimeContainer = styled(BaseGridItem)`
  grid-area: uptime;
  flex-direction: row;
  justify-content: space-between;
  padding: 0 16px;
`;

const StatusDotContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
`;

const StatusDot = styled.div.attrs((props: { active: boolean }) => props)`
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgb(13, 23, 30);
  background-color: ${(props) => (props.active ? STATUS_GREEN : STATUS_RED)};
  /* box-shadow: 0px 0px 4px 0.25px ${(props) => (props.active ? STATUS_GREEN : STATUS_RED)}; */

  animation: ${(props) => (props.active ? 'pulse-green 1.5s linear infinite' : 'pulse-red 1s linear infinite')};

  @keyframes pulse-green {
    0% {
      background-color: ${STATUS_GREEN};
    }
    50% {
      background-color: ${STATUS_GREEN_LIGHT};
    }
    100% {
      background-color: ${STATUS_GREEN};
    }
  }

  @keyframes pulse-red {
    0% {
      background-color: ${STATUS_RED};
    }
    50% {
      background-color: ${STATUS_RED_LIGHT};
    }
    100% {
      background-color: ${STATUS_RED};
    }
  }
`;

const START_DATE = Date.now();
const MS_PER_HOUR = 1000 * 60 * 60;

const PRICE_DATA = [
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 7,
    price: 125,
  },
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 6,
    price: 130,
  },
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 5,
    price: 115,
  },
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 4,
    price: 110,
  },
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 3,
    price: 132,
  },
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 2,
    price: 134,
  },
  {
    timestamp: START_DATE - MS_PER_HOUR * 24 * 1,
    price: 145,
  },
  {
    timestamp: START_DATE,
    price: 137,
  },
];

const old = [
  {
    token: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
    otherToken: GetTokenData('0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6'),
    percent: 0.3333,
  },
  {
    token: GetTokenData('0x8fd637b40a6ba572d1dc48fe853d9d06e6ab1ec6'),
    otherToken: GetTokenData('0x6950d4431fc13b465f9c93532823614fc8586598'),
    percent: 0.3333,
  },
  {
    token: GetTokenData('0xea1e4f047caaa24cf855ceeeda77cd353af81aec'),
    otherToken: GetTokenData('0xad5efe0d12c1b3fe87a171c83ce4cca4d85d381a'),
    percent: 0.3333,
  },
];

export type PortfolioGridProps = {
  balances: TokenBalance[];
  activeAsset: TokenData | null;
  tokenQuotes: TokenQuote[];
};

export default function PortfolioGrid(props: PortfolioGridProps) {
  const { balances, activeAsset, tokenQuotes } = props;
  const activeBalances = balances.filter(
    (balance) => activeAsset && balance.token.referenceAddress === activeAsset.referenceAddress
  );
  const totalBalanceUSD = activeBalances.reduce((acc, balance) => acc + balance.balanceUSD, 0);
  const totalBalance = activeBalances.reduce((acc, balance) => acc + balance.balance, 0);
  const apySum = activeBalances.reduce((acc, balance) => acc + balance.apy, 0);
  const apy = apySum / activeBalances.length;
  const activeSlices: TokenPercentage[] = activeBalances.map((balance) => ({
    token: balance.token,
    otherToken: balance.otherToken,
    percent: balance.balanceUSD / totalBalanceUSD,
    isKitty: balance.isKitty,
  }));
  const currentTokenQuote = tokenQuotes.find(
    (quote) => activeAsset && quote.token.address === (activeAsset.referenceAddress || activeAsset.address)
  );
  return (
    <Grid>
      <PieChartContainer>
        <PortfolioPieChartWidget tokenPercentages={activeSlices} token={activeAsset} />
      </PieChartContainer>
      <BalanceContainer>
        <Text size='L' color='rgba(130, 160, 182, 1)'>
          Balance
        </Text>
        <div>
          <Display size='L' className='inline-block mr-0.5'>
            {formatTokenAmount(totalBalance)}
          </Display>
          <Display size='S' className='inline-block ml-0.5'>
            {activeAsset?.ticker || ''}
          </Display>
        </div>
      </BalanceContainer>
      <APYContainer>
        <Text size='L' color='rgba(130, 160, 182, 1)'>
          APY
        </Text>
        <Display size='L'>{roundPercentage(apy, 3)}%</Display>
      </APYContainer>
      <PriceContainer>
        <PortfolioPriceChartWidget
          token={activeAsset}
          currentPrice={currentTokenQuote?.price || 0}
          prices={PRICE_DATA}
        />
      </PriceContainer>
      <UptimeContainer>
        <Text size='M' color='rgba(130, 160, 182, 1)'>
          Protocol Uptime
        </Text>
        <div className='flex items-center gap-2'>
          <Display size='S' className='inline-block mr-0.5'>
            100%
          </Display>
          <StatusDotContainer>
            <StatusDot active={true} />
          </StatusDotContainer>
        </div>
      </UptimeContainer>
    </Grid>
  );
}
