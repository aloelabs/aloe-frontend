import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';

import { TokenData } from '../../data/TokenData';
import { fixTimestamp } from '../../util/Dates';
import { formatUSD } from '../../util/Numbers';
import Graph from '../graph/Graph';

const GRAY_STROKE_COLOR = '#C2D1DD';
const GRAY_GRADIENT_COLOR = '#A7BDCE';

export type PriceEntry = {
  timestamp: number;
  price: number;
};

export type PortfolioPriceChartWidgetProps = {
  token: TokenData | null;
  currentPrice: number;
  prices: PriceEntry[];
};

export default function PortfolioPriceChartWidget(props: PortfolioPriceChartWidgetProps) {
  const { token, currentPrice, prices } = props;

  const data = React.useMemo(() => {
    let updatedData: any[] = [];
    prices.forEach((price) => {
      let currentObj = {} as any;
      currentObj['x'] = new Date(fixTimestamp(price.timestamp)).toISOString();
      currentObj['price'] = price.price;
      updatedData.push(currentObj);
    });
    return updatedData;
  }, [prices]);

  if (!token) {
    return null;
  }
  return (
    <div className='flex flex-col justify-between w-full'>
      <div className='flex justify-between items-center p-3'>
        <Text size='M'>{token?.ticker || ''} Price</Text>
        <Display size='M'>{formatUSD(currentPrice)}</Display>
      </div>
      <div className='h-full'>
        <Graph
          charts={[
            {
              type: 'monotone',
              dataKey: 'price',
              stroke: GRAY_STROKE_COLOR,
              fill: 'url(#priceGradient)',
              fillOpacity: 1,
            },
          ]}
          linearGradients={[
            <linearGradient id='priceGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='-29%' stopColor={GRAY_GRADIENT_COLOR} stopOpacity={0.25} />
              <stop offset='75%' stopColor={GRAY_GRADIENT_COLOR} stopOpacity={0} />
            </linearGradient>,
          ]}
          data={data}
          containerHeight={134}
          tickTextColor={GRAY_STROKE_COLOR}
          hideTicks={true}
        />
      </div>
    </div>
  );
}
