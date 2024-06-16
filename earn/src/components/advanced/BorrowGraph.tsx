import { LABEL_TEXT_COLOR } from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import {
  RESPONSIVE_BREAKPOINT_MD,
  RESPONSIVE_BREAKPOINT_SM,
  RESPONSIVE_BREAKPOINTS,
} from 'shared/lib/data/constants/Breakpoints';
import useMediaQuery from 'shared/lib/hooks/UseMediaQuery';
import styled from 'styled-components';

import BorrowGraphTooltip from './BorrowGraphTooltip';
import Graph from '../graph/Graph';

const TEXT_COLOR = '#82a0b6';
const GREEN_COLOR = '#82ca9d';
const PURPLE_COLOR = '#8884d8';
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_TO_SHOW = 60;
const NUM_DATA_POINTS = 100;

export type BorrowGraphData = {
  IV: number;
  LTV: number;
  x: Date;
};

/**
 * Linearly interpolates between two `BorrowGraphData` points to generate a new point with timestamp `x`
 * @param a One point that's close to the `x` value through which we're trying to interpolate
 * @param b Another point that's close to the `x` value through which we're trying to interpolate
 * @param x The timestamp (in millis) of the desired point
 * @returns A new point with x.getTime == x, IV between that of a and b, and collateral factor between that of a and b
 */
function interpolate(a: BorrowGraphData, b: BorrowGraphData, x: number) {
  const interpolated: BorrowGraphData = { x: new Date(x), IV: NaN, LTV: NaN };
  const deltaX = b.x.getTime() - a.x.getTime();

  const slopeIV = (b.IV - a.IV) / deltaX;
  interpolated.IV = slopeIV * (x - a.x.getTime()) + a.IV;

  const slopeCF = (b.LTV - a.LTV) / deltaX;
  interpolated.LTV = slopeCF * (x - a.x.getTime()) + a.LTV;

  return interpolated;
}

const Container = styled.div`
  height: 380px;
  width: 520px;
  margin-left: auto;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_MD}) {
    margin-left: 0;
    margin-right: auto;
    /* 99% is important here as the graph does not render properly at 100% width */
    width: 99%;
  }
`;

const LegendWrapper = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 32px;
  margin-top: 8px;
  margin-bottom: 24px;
`;

const LegendItem = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  text-align: center;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_SM}) {
    flex-direction: column;
  }
`;

const LegendItemBox = styled.div`
  width: 16px;
  height: 8px;
  background-color: ${(props) => props.color};
  border-radius: 8px;
`;

function GraphLegend() {
  return (
    <LegendWrapper>
      <LegendItem>
        <LegendItemBox color={PURPLE_COLOR} />
        <Text size='M' weight='medium' color={TEXT_COLOR}>
          IV
        </Text>
      </LegendItem>
      <LegendItem>
        <LegendItemBox color={GREEN_COLOR} />
        <Text size='M' weight='medium' color={TEXT_COLOR}>
          LTV
        </Text>
      </LegendItem>
    </LegendWrapper>
  );
}

export type BorrowGraphProps = {
  graphData: BorrowGraphData[];
};

export default function BorrowGraph(props: BorrowGraphProps) {
  const { graphData } = props;
  const isBiggerThanMobile = useMediaQuery(RESPONSIVE_BREAKPOINTS['SM']);

  const now = Date.now();

  const sortedGraphData = graphData.sort((item) => item.x.getTime());
  const startIdx = sortedGraphData.findIndex((item) => now - item.x.getTime() <= MILLIS_PER_DAY * DAYS_TO_SHOW);
  const endIdx = sortedGraphData.length - 1;

  if (startIdx === -1 || startIdx === endIdx) return null;

  // Timestamp of the first data point on the graph
  const t0 = sortedGraphData[startIdx].x.getTime();
  // Timestamp of the last data point on the graph
  const t1 = sortedGraphData[endIdx].x.getTime();
  // Time between consecutive points that's required to give us `NUM_DATA_POINTS` between `t0` and `t1`
  const dt = (t1 - t0) / NUM_DATA_POINTS;

  const interpGraphData: BorrowGraphData[] = [];

  let i = startIdx;
  for (let t = t0; t < t1; t += dt) {
    let b = sortedGraphData[i + 1];
    while (t > b.x.getTime()) {
      i += 1;
      b = sortedGraphData[i + 1];
    }
    const a = sortedGraphData[i];

    interpGraphData.push(interpolate(a, b, t));
  }

  const displayedGraphData = interpGraphData.map((item) => ({ ...item, x: item.x.toISOString() }));

  return (
    <Container>
      <Graph
        linearGradients={[
          <linearGradient id='ivGradient' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='-29%' stopColor={PURPLE_COLOR} stopOpacity={1} />
            <stop offset='75%' stopColor={PURPLE_COLOR} stopOpacity={0} />
          </linearGradient>,
          <linearGradient id='cfGradient' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='-29%' stopColor={GREEN_COLOR} stopOpacity={1} />
            <stop offset='75%' stopColor={GREEN_COLOR} stopOpacity={0} />
          </linearGradient>,
        ]}
        CustomTooltip={<BorrowGraphTooltip />}
        charts={[
          {
            dataKey: 'IV',
            fillOpacity: 0.2,
            stroke: PURPLE_COLOR,
            fill: 'url(#ivGradient)',
            type: 'monotone',
          },
          {
            dataKey: 'LTV',
            fillOpacity: 0.2,
            stroke: GREEN_COLOR,
            fill: 'url(#cfGradient)',
            type: 'monotone',
          },
        ]}
        showLegend={true}
        LegendContent={<GraphLegend />}
        data={displayedGraphData}
        hideTicks={!isBiggerThanMobile}
        containerHeight={380}
        tickTextColor={LABEL_TEXT_COLOR}
        showYAxis={true}
        yAxisUnit='%'
      />
    </Container>
  );
}
