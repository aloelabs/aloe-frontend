import { useEffect, useState } from 'react';

import { type WriteContractReturnType } from '@wagmi/core';
import { routerAbi } from 'shared/lib/abis/Router';
import AlertTriangle from 'shared/lib/assets/svg/AlertTriangle';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_ROUTER_ADDRESS, ETH_RESERVED_FOR_GAS } from 'shared/lib/data/constants/ChainSpecific';
import { ROUTER_TRANSMITTANCE, TERMS_OF_SERVICE_URL } from 'shared/lib/data/constants/Values';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import useChain from 'shared/lib/hooks/UseChain';
import { Permit2State, usePermit2 } from 'shared/lib/hooks/UsePermit2';
import { formatNumberInput, roundPercentage } from 'shared/lib/util/Numbers';
import styled from 'styled-components';
import { Address, Hash } from 'viem';
import { useAccount, useBalance, useSimulateContract, useWriteContract } from 'wagmi';

import { TokenIconsWithTooltip } from '../../common/TokenIconsWithTooltip';
import { SupplyTableRow } from '../supply/SupplyTable';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  PERMIT_ASSET,
  APPROVE_ASSET,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  LOADING,
  READY,
}

const permit2StateToButtonStateMap = {
  [Permit2State.ASKING_USER_TO_APPROVE]: ConfirmButtonState.WAITING_FOR_USER,
  [Permit2State.ASKING_USER_TO_SIGN]: ConfirmButtonState.WAITING_FOR_USER,
  [Permit2State.DONE]: undefined,
  [Permit2State.FETCHING_DATA]: ConfirmButtonState.LOADING,
  [Permit2State.READY_TO_APPROVE]: ConfirmButtonState.APPROVE_ASSET,
  [Permit2State.READY_TO_SIGN]: ConfirmButtonState.PERMIT_ASSET,
  [Permit2State.WAITING_FOR_TRANSACTION]: ConfirmButtonState.WAITING_FOR_TRANSACTION,
};

const AlertTriangleWrapper = styled.div`
  path {
    stroke: rgb(255, 122, 0);
  }
`;

function getConfirmButton(state: ConfirmButtonState, token: Token): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.symbol}`,
        enabled: false,
      };
    case ConfirmButtonState.PERMIT_ASSET:
      return {
        text: `Permit ${token.symbol}`,
        enabled: true,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.symbol}`,
        enabled: true,
      };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type DepositButtonProps = {
  hasAuxiliaryFunds: boolean;
  supplyAmount: GN;
  userBalanceTotal: GN;
  userBalanceToken: GN;
  token: Token;
  kitty: Kitty;
  accountAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

function DepositButton(props: DepositButtonProps) {
  const {
    hasAuxiliaryFunds,
    supplyAmount,
    userBalanceTotal,
    userBalanceToken,
    token,
    kitty,
    accountAddress,
    setIsOpen,
    setPendingTxn,
  } = props;
  const activeChain = useChain();

  // Normally, we use as much of the token as possible, and fill in the remainder with ETH
  // if (a) the token is WETH and (b) there's ETH available
  let supplyAmountToken = GN.min(supplyAmount, userBalanceToken);
  let supplyAmountEth = supplyAmount.lte(userBalanceTotal) ? supplyAmount.sub(supplyAmountToken) : undefined;
  // However, if there are auxiliary funds and the entered amount is greater than the user's balance,
  // we switch *entirely* to *just* use auxiliary funds. Currently only works with ETH on Base.
  const isUsingAuxiliaryFunds = hasAuxiliaryFunds && token.symbol === 'WETH' && supplyAmount.gt(userBalanceToken);
  if (isUsingAuxiliaryFunds) {
    supplyAmountToken = GN.zero(token.decimals);
    supplyAmountEth = supplyAmount;
  }

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, token, accountAddress, ALOE_II_ROUTER_ADDRESS[activeChain.id], supplyAmountToken);

  const depositWithPermit2Args = {
    address: ALOE_II_ROUTER_ADDRESS[activeChain.id],
    abi: routerAbi,
    functionName: 'depositWithPermit2',
    args: [
      kitty.address,
      permit2Result.amount.toBigInt(),
      ROUTER_TRANSMITTANCE,
      BigInt(permit2Result.nonce ?? '0'),
      BigInt(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    value: supplyAmountEth?.toBigInt(),
    chainId: activeChain.id,
  } as const;
  const { data: depsitWithPermit2Config, refetch: refetchDepositWithPermit2 } = useSimulateContract({
    ...depositWithPermit2Args,
    query: { enabled: permit2State === Permit2State.DONE && !isUsingAuxiliaryFunds },
  });
  const { writeContractAsync: depositWithPermit2, isPending } = useWriteContract();

  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (supplyAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (supplyAmount.gt(userBalanceTotal) && !isUsingAuxiliaryFunds) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    if (permit2Action) {
      permit2Action();
      return;
    }

    if (confirmButtonState === ConfirmButtonState.READY) {
      let method: Promise<Hash>;
      if (isUsingAuxiliaryFunds) {
        method = depositWithPermit2(depositWithPermit2Args);
      } else if (!depsitWithPermit2Config) {
        refetchDepositWithPermit2();
        return;
      } else {
        method = depositWithPermit2(depsitWithPermit2Config.request);
      }

      method
        .then((hash) => {
          setPendingTxn(hash);
          setIsOpen(false);
        })
        .catch((e) => console.error(e));
    }
  }

  return (
    <FilledStylizedButton
      size='M'
      onClick={() => handleClickConfirm()}
      fillWidth={true}
      disabled={!confirmButton.enabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type SupplyModalProps = {
  isOpen: boolean;
  hasAuxiliaryFunds: boolean;
  selectedRow: SupplyTableRow;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: WriteContractReturnType | null) => void;
};

export default function SupplyModal(props: SupplyModalProps) {
  const { isOpen, hasAuxiliaryFunds, selectedRow, setIsOpen, setPendingTxn } = props;
  const [amount, setAmount] = useState<string>('');
  const activeChain = useChain();
  const { address: userAddress } = useAccount();

  const { refetch: refetchBalanceToken, data: tokenBalanceResult } = useBalance({
    address: userAddress,
    token: selectedRow.asset.address,
    chainId: activeChain.id,
    query: { enabled: isOpen },
  });

  const isWeth = selectedRow.asset.name === 'Wrapped Ether';
  const { refetch: refetchBalanceEth, data: ethBalanceResult } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    query: { enabled: isOpen && isWeth },
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => {
      refetchBalanceToken();
      refetchBalanceEth();
    }, 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalanceToken, refetchBalanceEth]);

  const tokenBalance = GN.fromBigInt(tokenBalanceResult?.value ?? 0n, selectedRow.asset.decimals);
  const ethBalance = GN.fromBigInt(ethBalanceResult?.value ?? 0n, 18);
  const userBalance = isWeth
    ? tokenBalance.add(GN.max(ethBalance.sub(ETH_RESERVED_FOR_GAS[activeChain.id]), GN.zero(18)))
    : tokenBalance;

  const supplyAmount = GN.fromDecimalString(amount || '0', selectedRow.asset.decimals);
  const apyPercentage = roundPercentage(selectedRow.apy, 2).toFixed(2);

  const format = new Intl.ListFormat('en-US', {
    style: 'long',
    type: 'disjunction',
  });
  const formattedCollateral = format.format(selectedRow.collateralAssets.map((token) => token.symbol));
  const wasUpdatedInPast2Weeks = selectedRow.lastUpdated > Date.now() - 14 * 24 * 60 * 60 * 1000;

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Supply' maxHeight='650px'>
      <div className='w-full flex flex-col gap-4'>
        {!wasUpdatedInPast2Weeks && (
          <div className='border-2 border-caution flex items-center p-2 gap-2 rounded-lg'>
            <AlertTriangleWrapper>
              <AlertTriangle width={24} height={24} />
            </AlertTriangleWrapper>
            <Text size='XS' className='w-full'>
              In the past two weeks, no one has updated the implied volatility (IV) for this market. IV impacts risk
              parameters like LLTV. It's normally updated multiple times per day.
            </Text>
          </div>
        )}
        <TokenAmountInput
          token={selectedRow.asset}
          value={amount}
          max={userBalance.toString(GNFormat.DECIMAL)}
          maxed={supplyAmount.eq(userBalance)}
          onChange={(value) => {
            const output = formatNumberInput(value);
            if (output != null) {
              setAmount(output);
            }
          }}
        />
        <div>
          <Text size='M' weight='bold'>
            Collateral Assets
          </Text>
          <div className='w-full flex justify-start p-2'>
            <TokenIconsWithTooltip tokens={selectedRow.collateralAssets} width={24} height={24} />
          </div>
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex items-center gap-2'>
            <Text size='M' weight='bold'>
              Estimated APY
            </Text>
            <Tooltip
              buttonSize='S'
              buttonText=''
              content={`The actual APY is dynamic and is calculated based on the utilization of the pool.`}
              position='top-center'
              filled={true}
            />
          </div>
          <Text size='M' weight='bold' color={SECONDARY_COLOR}>
            {apyPercentage}%
          </Text>
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're supplying {amount || '0'} {selectedRow.asset.symbol} that users can borrow in exchange for{' '}
            {formattedCollateral}. You will earn a variable <strong>{apyPercentage}%</strong> APY on your supplied{' '}
            {selectedRow.asset.symbol}.
          </Text>
        </div>
        <DepositButton
          hasAuxiliaryFunds={hasAuxiliaryFunds}
          accountAddress={userAddress ?? '0x'}
          supplyAmount={supplyAmount}
          userBalanceTotal={userBalance}
          userBalanceToken={tokenBalance}
          kitty={selectedRow.kitty}
          token={selectedRow.asset}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxn}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By depositing, you agree to our{' '}
        <a href={TERMS_OF_SERVICE_URL} className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </Modal>
  );
}
