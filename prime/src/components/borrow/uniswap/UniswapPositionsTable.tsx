import { Provider } from '@wagmi/core';
import { BigNumber, Contract } from 'ethers';
import { useEffect, useState } from 'react';
import { Text } from 'shared/lib/components/common/Typography';
import styled from 'styled-components';
import { UniswapPosition } from '../../../data/Actions';
import useEffectOnce from '../../../data/hooks/UseEffectOnce';
import { MarginAccount } from '../../../data/MarginAccount';
import { formatTokenAmount, toBig } from '../../../util/Numbers';
import {
  calculateAmount0FromAmount1,
  getUniswapPoolBasics,
  UniswapV3PoolBasics,
  tickToPrice,
  calculateAmount1FromAmount0,
  uniswapPositionKey,
} from '../../../util/Uniswap';

const LABEL_TEXT_COLOR = 'rgba(130, 160, 182, 1)';

const StyledTable = styled.table`
  width: 100%;
  overflow: hidden;
`;

const StyledTableRows = styled.tr`
  width: 100%;
  overflow: hidden;
`;

const StyledTableHeader = styled.th`
  border-bottom: 1px solid rgba(26, 41, 52, 1);
  text-align: start;
  padding-top: 8px;
  padding-bottom: 8px;
`;

const StyledTableData = styled.td`
  border-bottom: 1px solid rgba(26, 41, 52, 1);
  text-align: start;
  padding-top: 8px;
  padding-bottom: 8px;
`;

type UniswapPositionEarnedFees = {
  [key: string]: {
    token0FeesEarned: number;
    token1FeesEarned: number;
  };
};

type UniswapPositionInfo = {
  value: number;
  feesEarned: number;
  lower: number;
  upper: number;
  positionKey: string;
};

function calculateUniswapPositionInfo(
  accountAddress: string,
  uniswapPosition: UniswapPosition,
  uniswapPoolBasics: UniswapV3PoolBasics,
  token0Decimals: number,
  token1Decimals: number,
  isInTermsOfToken0: boolean
): UniswapPositionInfo {
  if (
    uniswapPosition.lower == null ||
    uniswapPosition.upper == null ||
    uniswapPosition.amount0 === undefined ||
    uniswapPosition.amount1 === undefined
  ) {
    return {
      value: 0,
      feesEarned: 0,
      lower: 0,
      upper: 0,
      positionKey: '',
    };
  }
  const otherAmountInTermsOfActive = isInTermsOfToken0
    ? calculateAmount0FromAmount1(
        uniswapPosition.amount1,
        uniswapPosition.lower,
        uniswapPosition.upper,
        uniswapPoolBasics.slot0.tick,
        token0Decimals,
        token1Decimals
      ).amount0
    : calculateAmount1FromAmount0(
        uniswapPosition.amount0,
        uniswapPosition.lower,
        uniswapPosition.upper,
        uniswapPoolBasics.slot0.tick,
        token0Decimals,
        token1Decimals
      ).amount1;
  const bounds = [
    parseFloat(tickToPrice(uniswapPosition.lower, token0Decimals, token1Decimals, !isInTermsOfToken0)),
    parseFloat(tickToPrice(uniswapPosition.upper, token0Decimals, token1Decimals, !isInTermsOfToken0)),
  ];
  const lowerPrice = Math.min(...bounds);
  const upperPrice = Math.max(...bounds);
  const activeAmount = isInTermsOfToken0 ? uniswapPosition.amount0 : uniswapPosition.amount1;
  const value = activeAmount + parseFloat(otherAmountInTermsOfActive);
  return {
    value,
    feesEarned: 0,
    lower: lowerPrice,
    upper: upperPrice,
    positionKey: uniswapPositionKey(accountAddress, uniswapPosition.lower, uniswapPosition.upper),
  };
}

export type UniswapPositionsTableProps = {
  accountAddress: string;
  marginAccount: MarginAccount;
  marginAccountLensContract: Contract;
  provider: Provider;
  uniswapPositions: UniswapPosition[];
  isInTermsOfToken0: boolean;
};

export default function UniswapPositionTable(props: UniswapPositionsTableProps) {
  const { accountAddress, marginAccount, marginAccountLensContract, provider, uniswapPositions, isInTermsOfToken0 } =
    props;
  const [uniswapPoolBasics, setUniswapPoolBasics] = useState<UniswapV3PoolBasics | null>(null);
  const [uniswapPositionEarnedFees, setUniswapPositionEarnedFees] = useState<UniswapPositionEarnedFees>({});

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      const poolBasics = await getUniswapPoolBasics(marginAccount.uniswapPool, provider);
      if (mounted) {
        setUniswapPoolBasics(poolBasics);
      }
    }
    fetch();

    return () => {
      mounted = false;
    };
  }, [marginAccount.uniswapPool, provider]);

  useEffectOnce(() => {
    let mounted = true;
    async function fetch() {
      const earnedFees: [string[], BigNumber[]] = await marginAccountLensContract.getUniswapPositions(
        marginAccount.address
      );
      const earnedFeesMap: UniswapPositionEarnedFees = {};
      earnedFees[0].forEach((positionId, index) => {
        earnedFeesMap[positionId] = {
          token0FeesEarned: toBig(earnedFees[1][index])
            .div(10 ** marginAccount.token0.decimals)
            .toNumber(),
          token1FeesEarned: toBig(earnedFees[1][index + 1])
            .div(10 ** marginAccount.token1.decimals)
            .toNumber(),
        };
      });
      if (mounted) {
        setUniswapPositionEarnedFees(earnedFeesMap);
      }
    }
    fetch();

    return () => {
      mounted = false;
    };
  });

  if (!uniswapPoolBasics) {
    return null;
  }

  const columns = ['Value', 'Fees Earned', 'Lower', 'Upper'];

  const rows: UniswapPositionInfo[] = uniswapPositions.map((uniswapPosition: UniswapPosition) => {
    return calculateUniswapPositionInfo(
      accountAddress,
      uniswapPosition,
      uniswapPoolBasics,
      marginAccount.token0.decimals,
      marginAccount.token1.decimals,
      isInTermsOfToken0
    );
  });

  const selectedToken = isInTermsOfToken0 ? marginAccount.token0 : marginAccount.token1;

  return (
    <div className='overflow-x-auto'>
      <StyledTable>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <StyledTableHeader key={index}>
                <Text color={LABEL_TEXT_COLOR}>{column}</Text>
              </StyledTableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <StyledTableRows key={index}>
              <StyledTableData>
                <Text>
                  {formatTokenAmount(row.value)} {selectedToken?.ticker || ''}
                </Text>
              </StyledTableData>
              <StyledTableData>
                <Text>
                  {uniswapPositionEarnedFees[row.positionKey]?.token0FeesEarned || 0}{' '}
                  {marginAccount.token0?.ticker || ''}
                  {' + '}
                  {uniswapPositionEarnedFees[row.positionKey]?.token1FeesEarned || 0}{' '}
                  {marginAccount.token1?.ticker || ''}
                </Text>
              </StyledTableData>
              <StyledTableData>
                <Text>{formatTokenAmount(row.lower, 8)}</Text>
              </StyledTableData>
              <StyledTableData>
                <Text>{formatTokenAmount(row.upper, 8)}</Text>
              </StyledTableData>
            </StyledTableRows>
          ))}
        </tbody>
      </StyledTable>
    </div>
  );
}
