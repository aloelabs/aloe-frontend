import { Display, Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';

import { Token } from '../../data/Token';
import { TokenBalance, TokenPriceData, TokenQuote } from '../../pages/PortfolioPage';
import { rgb } from '../../util/Colors';
import AssetPriceChartWidget from './AssetPriceChartWidget';
import PortfolioMetrics from './PortfolioMetrics';

const STATUS_GREEN = 'rgba(0, 196, 140, 1)';
const STATUS_GREEN_LIGHT = 'rgba(0, 196, 140, 0.75)';
const STATUS_RED = '#FF4D4F';
const STATUS_RED_LIGHT = 'rgba(255, 77, 79, 0.75)';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 6fr 5fr 7fr;
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    'pie balance priceAndUptime'
    'pie apy priceAndUptime';
  grid-gap: 30px;
  height: 240px;
`;

const BaseGridItem = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: rgb(13, 23, 30);
  border-radius: 8px;
`;

const PriceAndUptimeContainer = styled.div`
  grid-area: priceAndUptime;

  display: grid;
  grid-template-rows: 160px 50px;
  grid-gap: 30px;
`;

export const PieChartContainer = styled(BaseGridItem)`
  grid-area: pie;
`;

export const BalanceContainer = styled(BaseGridItem)`
  grid-area: balance;
  position: relative;
  &.active::before {
    content: '';
    position: absolute;
    z-index: -1;
    top: calc(50% - 5px);
    left: -25px;
    width: 25px;
    height: 10px;
    background-color: rgba(130, 160, 182, 1);
  }
`;

export const APYContainer = styled(BaseGridItem)`
  grid-area: apy;
  position: relative;
  &.active::before {
    content: '';
    position: absolute;
    z-index: -1;
    top: calc(50% - 5px);
    left: -25px;
    width: 25px;
    height: 10px;
    background-color: rgba(130, 160, 182, 1);
  }
`;

const PriceContainer = styled(BaseGridItem)`
  overflow: hidden;
`;

const UptimeContainer = styled(BaseGridItem)`
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

export type PortfolioGridProps = {
  balances: TokenBalance[];
  activeAsset: Token | null;
  tokenColors: Map<string, string>;
  tokenQuotes: TokenQuote[];
  tokenPriceData: TokenPriceData[];
  errorLoadingPrices: boolean;
};

export default function PortfolioGrid(props: PortfolioGridProps) {
  const { balances, activeAsset, tokenColors, tokenQuotes, tokenPriceData, errorLoadingPrices } = props;
  const activeAssetAddress = activeAsset != null ? activeAsset.address : null;
  const currentTokenQuote =
    activeAssetAddress != null ? tokenQuotes.find((quote) => quote.token.address === activeAssetAddress) : undefined;
  const currentTokenPriceData =
    activeAsset != null ? tokenPriceData.find((data) => data.token.address === activeAsset.address) : undefined;
  const activeColor = activeAsset ? tokenColors.get(activeAsset.address) : undefined;
  return (
    <Grid>
      <PortfolioMetrics balances={balances} activeAsset={activeAsset} activeColor={activeColor} />
      <PriceAndUptimeContainer>
        <PriceContainer>
          <AssetPriceChartWidget
            token={activeAsset}
            color={activeColor !== undefined ? rgb(activeColor) : 'transparent'}
            currentPrice={currentTokenQuote?.price || 0}
            priceEntries={currentTokenPriceData?.priceEntries || []}
            error={errorLoadingPrices}
          />
        </PriceContainer>
        <UptimeContainer>
          <Text size='S' color='rgba(130, 160, 182, 1)'>
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
      </PriceAndUptimeContainer>
    </Grid>
  );
}
