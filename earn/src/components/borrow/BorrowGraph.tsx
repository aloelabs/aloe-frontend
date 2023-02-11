import { Text } from 'shared/lib/components/common/Typography';
import useMediaQuery from 'shared/lib/data/hooks/UseMediaQuery';
import styled from 'styled-components';

import {
  RESPONSIVE_BREAKPOINT_MD,
  RESPONSIVE_BREAKPOINT_SM,
  RESPONSIVE_BREAKPOINTS,
} from '../../data/constants/Breakpoints';
import Graph from '../graph/Graph';
import BorrowGraphTooltip from './BorrowGraphTooltip';

const TEXT_COLOR = '#82a0b6';
const GREEN_COLOR = '#82ca9d';
const PURPLE_COLOR = '#8884d8';

export type BorrowGraphData = {
  IV: number;
  'Collateral Factor': number;
  x: string;
};

const Container = styled.div`
  height: 300px;
  width: 450px;
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
          Collateral Factor
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
            dataKey: 'Collateral Factor',
            fillOpacity: 0.2,
            stroke: GREEN_COLOR,
            fill: 'url(#cfGradient)',
            type: 'monotone',
          },
        ]}
        showLegend={true}
        LegendContent={<GraphLegend />}
        data={graphData}
        hideTicks={!isBiggerThanMobile}
        containerHeight={300}
        tickTextColor='#ffffff'
        showYAxis={true}
        yAxisUnit='%'
      />
    </Container>
  );
}
