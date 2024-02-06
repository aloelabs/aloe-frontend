import { SVGProps, useMemo } from 'react';

import { Text } from 'shared/lib/components/common/Typography';
import { GREY_600 } from 'shared/lib/data/constants/Colors';
import styled from 'styled-components';

import { LendingPair } from '../../data/LendingPair';
import LineGraph, { GraphChart } from '../graph/LineGraph';
import InfoGraphTooltip from './InfoGraphTooltip';

const FULL_HEIGHT = '342';

const Container = styled.div`
  border: 2px solid ${GREY_600};
  border-radius: 6px;

  height: 100%;
  width: 100%;
`;

const Header = styled.div`
  border-bottom: 2px solid ${GREY_600};
`;

export type InfoGraphLabel = `${string}/${string}`;
export type InfoGraphData = Map<InfoGraphLabel, { x: Date; ltv: number }[]>;
export type InfoGraphColors = Map<InfoGraphLabel, { color0: string; color1: string }>;

export default function InfoGraph(props: {
  graphData: InfoGraphData | undefined;
  graphColors: InfoGraphColors;
  hoveredPair: LendingPair | undefined;
}) {
  const { graphData, graphColors, hoveredPair } = props;
  const labels = Array.from(graphData?.keys() ?? []);

  const displayedGraphData = useMemo(() => {
    const flattened: { [k: InfoGraphLabel]: number; x: Date }[] = [];
    graphData?.forEach((arr, label) =>
      arr.forEach((point) => {
        const entry = {
          x: point.x,
          [label]: point.ltv * 100,
        } as { [k: InfoGraphLabel]: number; x: Date };

        flattened.push(entry);
      })
    );

    flattened.sort((a, b) => a.x.getTime() - b.x.getTime());

    const displayed: { [k: InfoGraphLabel]: number; x: number }[] = [];
    for (let i = 0; i < flattened.length; i++) {
      const entry = { ...flattened[i], x: flattened[i].x.getTime() };

      if (entry.x !== displayed.at(-1)?.x) {
        displayed.push({
          ...(displayed.at(-1) ?? {}),
          ...entry,
        });
        continue;
      }

      const previousEntry = displayed.at(-1)!;
      Object.assign(previousEntry, entry);
    }

    return displayed;
  }, [graphData]);

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
        <linearGradient id={k.replace('/', '-')} x1='0' y1='0' x2='100%' y2='0' gradientUnits='userSpaceOnUse'>
          <stop offset='-29%' stopColor={v.color0} stopOpacity={1} />
          <stop offset='75%' stopColor={v.color1} stopOpacity={1} />
        </linearGradient>
      );
    });

    return arr;
  }, [graphColors]);

  if (!graphData) return null;

  return (
    <Container>
      <Header className='w-full px-4 py-2 text-center whitespace-nowrap'>
        <Text size='M' weight='bold'>
          LTV History
        </Text>
      </Header>
      <LineGraph
        linearGradients={linearGradients}
        CustomTooltip={<InfoGraphTooltip />}
        charts={charts}
        data={displayedGraphData}
        size={{
          width: '100%',
          height: Number(FULL_HEIGHT) - 48,
        }}
      />
    </Container>
  );
}
