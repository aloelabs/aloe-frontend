import React from 'react';

import { Display, Text } from 'shared/lib/components/common/Typography';

import { TokenData } from '../../data/TokenData';
import { fixTimestamp } from '../../util/Dates';
import { formatUSD } from '../../util/Numbers';
import Graph from '../graph/Graph';
import PriceChartTooltip from './PriceChartTooltip';

const GRAY_STROKE_COLOR = '#C2D1DD';
const GRAY_GRADIENT_COLOR = '#A7BDCE';

export type PriceEntry = {
  timestamp: number;
  price: number;
};

export type PortfolioPriceChartWidgetProps = {
  token: TokenData | null;
  color: string;
  currentPrice: number;
  prices: number[][];
};

export default function PortfolioPriceChartWidget(props: PortfolioPriceChartWidgetProps) {
  const { token, color, currentPrice, prices } = props;

  const data = React.useMemo(() => {
    let updatedData: any[] = [];
    prices.forEach((price) => {
      let currentObj = {} as any;
      currentObj['x'] = new Date(fixTimestamp(price[0])).toISOString();
      currentObj['price'] = price[1];
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
          containerHeight={134}
          CustomTooltip={<PriceChartTooltip />}
          tickTextColor={GRAY_STROKE_COLOR}
          yAxisDomain={[(dataMin: number) => dataMin / 1.1, 'dataMax']}
          hideTicks={true}
        />
      </div>
    </div>
  );
}
