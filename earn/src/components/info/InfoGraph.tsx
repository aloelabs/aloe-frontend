import { SVGProps, useEffect, useMemo, useState } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { RESPONSIVE_BREAKPOINTS, RESPONSIVE_BREAKPOINT_TABLET } from 'shared/lib/data/constants/Breakpoints';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

import { LendingPair } from '../../data/LendingPair';
import LineGraph, { GraphChart } from '../graph/LineGraph';
import InfoGraphTooltip from './InfoGraphTooltip';

const MOBILE_HEIGHT = '320';
const FULL_HEIGHT = '642';
const FULL_WIDTH = '260';

const TableContainer = styled.div`
  overflow-x: auto;
  border: 2px solid ${GREY_600};
  border-radius: 6px;

  height: 100%;
  min-width: ${FULL_WIDTH}px;
  max-width: ${FULL_WIDTH}px;
  width: ${FULL_WIDTH}px;

  @media (max-width: ${RESPONSIVE_BREAKPOINT_TABLET}) {
    min-width: 100%;
    max-width: 100%;
    width: 100%;
  }
`;

const Table = styled.table`
  border-spacing: 0;
  border-collapse: separate;
`;

const TableHeaderElement = styled.th`
  border-bottom: 2px solid ${GREY_600};
`;

export type InfoGraphLabel = `${string}/${string}`;
export type InfoGraphData = Map<InfoGraphLabel, { x: Date; ltv: number }[]>;
export type InfoGraphColors = Map<InfoGraphLabel, { color0: string; color1: string }>;

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return { width, height };
}

export default function InfoGraph(props: {
  graphData: InfoGraphData | undefined;
  graphColors: InfoGraphColors;
  hoveredPair: LendingPair | undefined;
}) {
  const { graphData, graphColors, hoveredPair } = props;
  const labels = Array.from(graphData?.keys() ?? []);

  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());
  const isTabletOrBigger = windowDimensions.width > RESPONSIVE_BREAKPOINTS['TABLET'];

  useEffect(() => {
    const handleResize = () => setWindowDimensions(getWindowDimensions());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const flattenedGraphData: { [k: InfoGraphLabel]: number; x: Date }[] = [];
  graphData?.forEach((arr, label) =>
    arr.forEach((point) => {
      const entry = {
        x: point.x,
        [label]: point.ltv * 100,
      } as { [k: InfoGraphLabel]: number; x: Date };

      flattenedGraphData.push(entry);
    })
  );

  flattenedGraphData.sort((a, b) => a.x.getTime() - b.x.getTime());

  const displayedGraphData: { [k: InfoGraphLabel]: number; x: number }[] = [];
  for (let i = 0; i < flattenedGraphData.length; i++) {
    const entry = { ...flattenedGraphData[i], x: flattenedGraphData[i].x.getTime() };

    if (entry.x !== displayedGraphData.at(-1)?.x) {
      displayedGraphData.push({
        ...(displayedGraphData.at(-1) ?? {}),
        ...entry,
      });
      continue;
    }

    const previousEntry = displayedGraphData.at(-1)!;
    Object.assign(previousEntry, entry);
  }

  const charts: GraphChart[] = useMemo(
    () =>
      labels.map((label) => {
        const shouldBeColored =
          hoveredPair === undefined || label === `${hoveredPair!.token0.symbol}/${hoveredPair!.token1.symbol}`;
        let stroke = 'rgba(43, 64, 80, 0.5)';
        if (shouldBeColored) {
          stroke = graphColors.has(label) ? `url(#${label.replace('/', '-')})` : 'white';
        }

        const shouldBeThick = shouldBeColored && hoveredPair !== undefined;

        return {
          uniqueId: label,
          dataKey: label,
          stroke,
          strokeWidth: shouldBeThick ? 4 : 2,
          type: 'monotone',
        };
      }),
    [labels, graphColors, hoveredPair]
  );

  const linearGradients = useMemo(() => {
    const arr: SVGProps<SVGLinearGradientElement>[] = [];

    graphColors.forEach((v, k) => {
      arr.push(
        <linearGradient id={k.replace('/', '-')} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='-29%' stopColor={v.color0} stopOpacity={1} />
          <stop offset='75%' stopColor={v.color1} stopOpacity={1} />
        </linearGradient>
      );
    });

    return arr;
  }, [graphColors]);

  return (
    <TableContainer>
      <Table>
        <thead className='text-start'>
          <tr>
            <TableHeaderElement className='px-4 py-2 text-center whitespace-nowrap'>
              <Text size='M' weight='bold'>
                LTV History
              </Text>
            </TableHeaderElement>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {graphData && (
                <LineGraph
                  linearGradients={linearGradients}
                  CustomTooltip={<InfoGraphTooltip />}
                  tooltipPosition={{ x: 0, y: 0 }}
                  charts={charts}
                  data={displayedGraphData}
                  size={
                    isTabletOrBigger
                      ? {
                          width: Number(FULL_WIDTH),
                          height: Number(FULL_HEIGHT) - 48,
                        }
                      : {
                          width: windowDimensions.width - 32,
                          height: Number(MOBILE_HEIGHT) - 48,
                        }
                  }
                />
              )}
            </td>
          </tr>
        </tbody>
      </Table>
    </TableContainer>
  );
}
