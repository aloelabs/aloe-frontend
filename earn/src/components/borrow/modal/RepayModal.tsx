import { useContext, useState, useEffect } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import { BigNumber } from 'ethers';
import { routerABI } from 'shared/lib/abis/Router';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import Modal from 'shared/lib/components/common/Modal';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { usePermit2, Permit2State } from 'shared/lib/data/hooks/UsePermit2';
import { Token } from 'shared/lib/data/Token';
import { formatNumberInput, truncateDecimals } from 'shared/lib/util/Numbers';
import { useAccount, usePrepareContractWrite, useContractWrite, useBalance, Address, Chain } from 'wagmi';

import { ChainContext } from '../../../App';
import { isSolvent } from '../../../data/BalanceSheet';
import { ALOE_II_ROUTER_ADDRESS } from '../../../data/constants/Addresses';
import { Liabilities, MarginAccount } from '../../../data/MarginAccount';
import { UniswapPosition } from '../../../data/Uniswap';
import TokenAmountSelectInput from '../../portfolio/TokenAmountSelectInput';
import HealthBar from '../HealthBar';

const GAS_ESTIMATE_WIGGLE_ROOM = 110; // 10% wiggle room
const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_FUNDS,
  REPAYING_TOO_MUCH,
  PERMIT_ASSET,
  APPROVE_ASSET,
  WAITING_FOR_TRANSACTION,
  WAITING_FOR_USER,
  READY,
  LOADING,
  DISABLED,
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
    case ConfirmButtonState.INSUFFICIENT_FUNDS:
      return { text: `Insufficient ${token.symbol}`, enabled: false };
    case ConfirmButtonState.REPAYING_TOO_MUCH:
      return { text: 'Repaying too much', enabled: false };
    case ConfirmButtonState.PERMIT_ASSET:
      return { text: `Permit ${token.symbol}`, enabled: true };
    case ConfirmButtonState.APPROVE_ASSET:
      return { text: `Approve ${token.symbol}`, enabled: true };
    case ConfirmButtonState.WAITING_FOR_TRANSACTION:
      return { text: 'Pending', enabled: false };
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

type RepayButtonProps = {
  activeChain: Chain;
  marginAccount: MarginAccount;
  userAddress: Address;
  lender: Address;
  repayAmount: GN;
  repayToken: Token;
  repayTokenBalance: GN;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (result: SendTransactionResult | null) => void;
};

function RepayButton(props: RepayButtonProps) {
  const {
    activeChain,
    marginAccount,
    userAddress,
    lender,
    repayAmount,
    repayToken,
    repayTokenBalance,
    setIsOpen,
    setPendingTxn,
  } = props;

  const [isPending, setIsPending] = useState(false);

  const {
    state: permit2State,
    action: permit2Action,
    result: permit2Result,
  } = usePermit2(activeChain, repayToken, userAddress, ALOE_II_ROUTER_ADDRESS, repayAmount);

  const { config: repayWithPermit2Config, refetch: refetchRepayWithPermit2 } = usePrepareContractWrite({
    address: ALOE_II_ROUTER_ADDRESS,
    abi: routerABI,
    functionName: 'repayWithPermit2',
    args: [
      lender,
      permit2Result.amount.toBigNumber(),
      marginAccount.address,
      BigNumber.from(permit2Result.nonce ?? '0'),
      BigNumber.from(permit2Result.deadline),
      permit2Result.signature ?? '0x',
    ],
    chainId: activeChain.id,
    enabled: permit2State === Permit2State.DONE,
  });
  // NOTE: Not using `useMemo` to update the request
  const gasLimit = repayWithPermit2Config.request?.gasLimit.mul(GAS_ESTIMATE_WIGGLE_ROOM).div(100);
  const {
    write: repayWithPermit2,
    isError: contractDidError,
    isSuccess: contractDidSucceed,
    data: contractData,
  } = useContractWrite({
    ...repayWithPermit2Config,
    request: {
      ...repayWithPermit2Config.request,
      gasLimit,
    },
  });

  useEffect(() => {
    if (contractDidSucceed && contractData) {
      setPendingTxn(contractData);
      setIsPending(false);
      setIsOpen(false);
    } else if (contractDidSucceed) {
      setIsPending(false);
    }
  }, [contractDidSucceed, contractData, contractDidError, setPendingTxn, setIsOpen]);

  // MARK: Preparing data that's necessary to figure out button state -------------------------------------------------
  const existingLiability = marginAccount.liabilities[lender === marginAccount.lender0 ? 'amount0' : 'amount1'];
  const existingLiabilityGN = GN.fromNumber(existingLiability, repayToken.decimals);

  // MARK: Determining button state -----------------------------------------------------------------------------------
  let confirmButtonState: ConfirmButtonState;
  if (isPending) {
    confirmButtonState = ConfirmButtonState.WAITING_FOR_TRANSACTION;
  } else if (repayAmount.isZero()) {
    confirmButtonState = ConfirmButtonState.LOADING;
  } else if (repayAmount.gt(repayTokenBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_FUNDS;
  } else if (repayAmount.gt(existingLiabilityGN)) {
    confirmButtonState = ConfirmButtonState.REPAYING_TOO_MUCH;
  } else {
    confirmButtonState = permit2StateToButtonStateMap[permit2State] ?? ConfirmButtonState.READY;
  }

  // MARK: Get the button itself --------------------------------------------------------------------------------------
  // --> UI
  const confirmButton = getConfirmButton(confirmButtonState, repayToken);
  // --> action
  const confirmButtonAction = () => {
    if (permit2Action) {
      permit2Action();
      return;
    }

    if (confirmButtonState === ConfirmButtonState.READY) {
      if (!repayWithPermit2) {
        refetchRepayWithPermit2();
        return;
      }
      setIsPending(true);
      repayWithPermit2();
    }
  };

  return (
    <FilledStylizedButton size='M' fillWidth={true} disabled={!confirmButton.enabled} onClick={confirmButtonAction}>
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type RepayModalProps = {
  marginAccount: MarginAccount;
  uniswapPositions: readonly UniswapPosition[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function RepayModal(props: RepayModalProps) {
  const { marginAccount, uniswapPositions, isOpen, setIsOpen, setPendingTxn } = props;

  const { activeChain } = useContext(ChainContext);
  const [repayAmountStr, setRepayAmountStr] = useState('');
  const [repayToken, setRepayToken] = useState<Token>(marginAccount.token0);

  const { address: userAddress } = useAccount();
  const { data: tokenBalanceFetch } = useBalance({
    address: userAddress,
    chainId: activeChain.id,
    token: repayToken.address,
    watch: false,
    enabled: isOpen,
  });
  const tokenBalance = GN.fromBigNumber(tokenBalanceFetch?.value ?? BigNumber.from('0'), repayToken.decimals);

  // Reset repay amount and token when modal is opened/closed or when the margin account token0 changes
  useEffect(() => {
    setRepayAmountStr('');
    setRepayToken(marginAccount.token0);
  }, [isOpen, marginAccount.token0]);

  const existingLiabilityNumber =
    repayToken.address === marginAccount.token0.address
      ? marginAccount.liabilities.amount0
      : marginAccount.liabilities.amount1;
  const existingLiability = GN.fromNumber(existingLiabilityNumber, repayToken.decimals);
  const repayAmount = GN.fromDecimalString(repayAmountStr || '0', repayToken.decimals);
  const remainingLiability = existingLiability.sub(repayAmount);

  const maxRepay = GN.min(existingLiability, tokenBalance);

  const newLiabilities: Liabilities = {
    amount0:
      repayToken.address === marginAccount.token0.address
        ? parseFloat(remainingLiability.toString(GNFormat.DECIMAL))
        : marginAccount.liabilities.amount0,
    amount1:
      repayToken.address === marginAccount.token1.address
        ? parseFloat(remainingLiability.toString(GNFormat.DECIMAL))
        : marginAccount.liabilities.amount1,
  };

  const { health: newHealth } = isSolvent(
    marginAccount.assets,
    newLiabilities,
    uniswapPositions,
    marginAccount.sqrtPriceX96,
    marginAccount.iv,
    marginAccount.token0.decimals,
    marginAccount.token1.decimals
  );

  if (!userAddress || !isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} title='Repay' setIsOpen={setIsOpen} maxHeight='650px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                setRepayAmountStr(maxRepay.toString(GNFormat.DECIMAL));
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={repayAmountStr}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                const truncatedOutput = truncateDecimals(output, repayToken.decimals);
                setRepayAmountStr(truncatedOutput);
              }
            }}
            onSelect={(option: Token) => {
              setRepayAmountStr('');
              setRepayToken(option);
            }}
            options={[marginAccount.token0, marginAccount.token1]}
            selectedOption={repayToken}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're repaying{' '}
            <strong>
              {repayAmountStr || '0'} {repayToken.symbol}
            </strong>
            . This will increase your smart wallet's health and bring remaining borrows down to{' '}
            <strong>
              {remainingLiability.toString(GNFormat.DECIMAL)} {repayToken.symbol}
            </strong>
            .
          </Text>
          <div className='mt-2'>
            <HealthBar health={newHealth} />
          </div>
        </div>
        <div className='w-full'>
          <RepayButton
            activeChain={activeChain}
            marginAccount={marginAccount}
            userAddress={userAddress}
            lender={repayToken.address === marginAccount.token0.address ? marginAccount.lender0 : marginAccount.lender1}
            repayAmount={repayAmount}
            repayToken={repayToken}
            repayTokenBalance={tokenBalance}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By using our service, you agree to our{' '}
            <a href='/terms.pdf' className='underline' rel='noreferrer' target='_blank'>
              Terms of Service
            </a>{' '}
            and acknowledge that you may lose your money. Aloe Labs is not responsible for any losses you may incur. It
            is your duty to educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
