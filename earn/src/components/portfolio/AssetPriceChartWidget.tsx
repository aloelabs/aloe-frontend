import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';
import { Token } from 'shared/lib/data/Token';
import { formatUSD } from 'shared/lib/util/Numbers';
import styled from 'styled-components';

import { ReactComponent as AlertTriangleIcon } from '../../assets/svg/alert_triangle.svg';
import { PriceEntry } from '../../pages/PortfolioPage';
import { fixTimestamp } from '../../util/Dates';
import Graph from '../graph/Graph';
import AssetPriceChartTooltip from './AssetPriceChartTooltip';

const GRAY_STROKE_COLOR = '#C2D1DD';
const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 8px;
  height: 122px;
`;

const AlertTriangleIconWrapper = styled.div`
  width: 32px;
  height: 32px;
  svg {
    path {
      stroke: ${SECONDARY_COLOR};
    }
  }
`;

export type PortfolioPriceChartWidgetProps = {
  token: Token | null;
  color: string;
  currentPrice: number;
  priceEntries: PriceEntry[];
  error: boolean;
};

export default function AssetPriceChartWidget(props: PortfolioPriceChartWidgetProps) {
  const { token, color, currentPrice, priceEntries, error } = props;

  const data = React.useMemo(() => {
    let updatedData: any[] = [];
    priceEntries.forEach((priceEntry) => {
      let currentObj = {} as any;
      currentObj['x'] = new Date(fixTimestamp(priceEntry.timestamp)).toISOString();
      currentObj['price'] = priceEntry.price;
      updatedData.push(currentObj);
    });
    return updatedData;
  }, [priceEntries]);

  if (!token) {
    return null;
  }
  return (
    <div className='flex flex-col justify-between w-full'>
      <div className='flex justify-between items-center my-2 px-3'>
        <Text size='S' weight='bold' color='rgba(130, 160, 182, 1)'>
          {token.symbol} Price
        </Text>
        <Display size='M'>{error ? '-' : formatUSD(currentPrice)}</Display>
      </div>
      <div className='h-full'>
        {error ? (
          <ErrorContainer>
            <AlertTriangleIconWrapper>
              <AlertTriangleIcon width={32} height={32} />
            </AlertTriangleIconWrapper>
            <Text size='M' color={SECONDARY_COLOR}>
              Error loading price data
            </Text>
          </ErrorContainer>
        ) : (
          <Graph
            charts={[
              {
                type: 'monotone',
                dataKey: 'price',
                stroke: color,
                fill: 'url(#priceGradient)',
                fillOpacity: 1,
              },
            ]}
            linearGradients={[
              <linearGradient id='priceGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='-29%' stopColor={color} stopOpacity={0.4} />
                <stop offset='100%' stopColor={color} stopOpacity={0} />
              </linearGradient>,
            ]}
            data={data}
            containerHeight={122}
            CustomTooltip={<AssetPriceChartTooltip />}
            tickTextColor={GRAY_STROKE_COLOR}
            yAxisDomain={[(dataMin: number) => dataMin / 1.05, 'dataMax']}
            hideTicks={true}
          />
        )}
      </div>
    </div>
  );
}
