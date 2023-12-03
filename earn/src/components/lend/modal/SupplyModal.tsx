import { useContext, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { routerAbi } from 'shared/lib/abis/Router';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { ALOE_II_ROUTER_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { Permit2State, usePermit2 } from 'shared/lib/data/hooks/UsePermit2';
import { Kitty } from 'shared/lib/data/Kitty';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, roundPercentage } from 'shared/lib/util/Numbers';
import { Address, useAccount, useBalance, useContractWrite, usePrepareContractWrite } from 'wagmi';

import { ChainContext } from '../../../App';
import { TokenIconsWithTooltip } from '../../common/TokenIconsWithTooltip';
import { SupplyTableRow } from '../SupplyTable';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';
const TERTIARY_COLOR = '#4b6980';
const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room

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
  depositAmount: GN;
  depositBalance: GN;
  token: Token;
  kitty: Kitty;
  accountAddress: Address;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function DepositButton(props: DepositButtonProps) {
  const { depositAmount, depositBalance, token, kitty, accountAddress, setIsOpen, setPendingTxn } = props;
  const { activeChain } = useContext(ChainContext);
  const [isPending, setIsPending] = useState(false);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, token, accountAddress, ALOE_II_ROUTER_ADDRESS[activeChain.id], depositAmount);

  const { config: depsitWithPermit2Config, refetch: refetchDepositWithPermit2 } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS[activeChain.id],
    abi: routerAbi,
    functionName: 'depositWithPermit2',
    args: [
      kitty.address,
      permit2Result.amount.toBigNumber(),
      BigNumber.from(permit2Result.nonce ?? '0'),
      BigNumber.from(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    chainId: activeChain.id,
    enabled: permit2State === Permit2State.DONE,
  });
  const depositWithPermit2ConfigUpdatedRequest = useMemo(() => {
    if (depsitWithPermit2Config.request) {
      return {
        ...depsitWithPermit2Config.request,
        gasLimit: depsitWithPermit2Config.request.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100),
      };
    }
    return undefined;
  }, [depsitWithPermit2Config.request]);
  const {
    write: depositWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useContractWrite({
    ...depsitWithPermit2Config,
    request: depositWithPermit2ConfigUpdatedRequest,
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (contractDidError) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn, setIsOpen]);

  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (depositAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (depositAmount.gt(depositBalance)) {
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
      if (!depsitWithPermit2Config.request) {
        refetchDepositWithPermit2();
        return;
      }
      setIsPending(true);
      depositWithPermit2?.();
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
  selectedRow: SupplyTableRow;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function SupplyModal(props: SupplyModalProps) {
  const { isOpen, selectedRow, setIsOpen, setPendingTxn } = props;
  const [amount, setAmount] = useState<string>('');
  const { activeChain } = useContext(ChainContext);
  const { address: userAddress } = useAccount();

  const { refetch: refetchBalance, data: userBalanceResult } = useBalance({
    address: userAddress,
    token: selectedRow.asset.address,
    chainId: activeChain.id,
    watch: false,
    enabled: isOpen,
  });

  useEffect(() => {
    let interval: NodeJS.Timer | null = null;
    interval = setInterval(() => refetchBalance(), 13_000);
    return () => {
      if (interval != null) {
        clearInterval(interval);
      }
    };
  }, [refetchBalance]);

  const userBalance = GN.fromDecimalString(userBalanceResult?.formatted ?? '0', selectedRow.asset.decimals);
  const supplyAmount = GN.fromDecimalString(amount || '0', selectedRow.asset.decimals);
  const apyPercentage = roundPercentage(selectedRow.apy, 2).toFixed(2);

  const format = new Intl.ListFormat('en-US', {
    style: 'long',
    type: 'disjunction',
  });
  const formattedCollateral = format.format(selectedRow.collateralAssets.map((token) => token.symbol));

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title='Supply'>
      <div className='w-full flex flex-col gap-4'>
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
          accountAddress={userAddress ?? '0x'}
          depositAmount={supplyAmount}
          depositBalance={userBalance}
          kitty={selectedRow.kitty}
          token={selectedRow.asset}
          setIsOpen={setIsOpen}
          setPendingTxn={setPendingTxn}
        />
      </div>
      <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
        By depositing, you agree to our{' '}
        <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
          Terms of Service
        </a>{' '}
        and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is
        your duty to educate yourself and be aware of the risks.
      </Text>
    </Modal>
  );
}
