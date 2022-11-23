import { ReactElement, useEffect, useMemo, useState } from 'react';

import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { Text } from 'shared/lib/components/common/Typography';
import { Chain, useContractWrite, useNetwork } from 'wagmi';

import KittyABI from '../../../assets/abis/Kitty.json';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../assets/svg/more_ellipses.svg';
import { DEFAULT_CHAIN } from '../../../data/constants/Values';
import { Kitty } from '../../../data/Kitty';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { TokenBalance } from '../../../pages/PortfolioPage';
import TokenAmountInput from '../../common/TokenAmountInput';
import TokenDropdown from '../../common/TokenDropdown';
import PortfolioModal from './PortfolioModal';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_ASSET,
  APPROVE_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token: Token
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.APPROVE_ASSET:
      return {
        text: `Approve ${token.ticker}`,
        Icon: <CheckIcon />,
        enabled: true,
      };
    case ConfirmButtonState.PENDING:
      return { text: 'Pending', Icon: <MoreIcon />, enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: true };
    case ConfirmButtonState.LOADING:
    default:
      return { text: 'Confirm', Icon: <CheckIcon />, enabled: false };
  }
}

type WithdrawButtonProps = {
  withdrawAmount: string;
  withdrawBalance: string;
  token: Token;
  kitty: Kitty;
  activeChain: Chain;
  setIsOpen: (isOpen: boolean) => void;
};

function WithdrawButton(props: WithdrawButtonProps) {
  const { withdrawAmount, withdrawBalance, token, kitty, activeChain, setIsOpen } = props;
  const [isPending, setIsPending] = useState(false);

  const contract = useContractWrite({
    address: kitty.address,
    abi: KittyABI,
    mode: 'recklesslyUnprepared',
    functionName: 'withdraw',
    chainId: activeChain.id,
  });

  const numericDepositBalance = Number(withdrawBalance) || 0;
  const numericDepositAmount = Number(withdrawAmount) || 0;

  let confirmButtonState = ConfirmButtonState.READY;

  if (numericDepositAmount > numericDepositBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, token);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    if (confirmButtonState === ConfirmButtonState.READY) {
      setIsPending(true);
      contract
        .writeAsync?.({
          recklesslySetUnpreparedArgs: [ethers.utils.parseUnits(withdrawAmount, token.decimals).toString()],
          recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
        })
        .then((txnResult) => {
          // If the user accepts the transaction, close the modal and wait for the transaction to be verified
          setIsOpen(false);
          setIsPending(false);
          // TODO: Add loading state
        })
        .catch((error) => {
          // If the user rejects the transaction, we want to reset the pending state
          setIsPending(false);
        });
    }
  }

  const isDepositAmountValid = numericDepositAmount > 0;
  const shouldConfirmButtonBeDisabled = !(confirmButton.enabled && isDepositAmountValid);

  return (
    <FilledStylizedButton
      size='M'
      onClick={() => handleClickConfirm()}
      fillWidth={true}
      disabled={shouldConfirmButtonBeDisabled}
    >
      {confirmButton.text}
    </FilledStylizedButton>
  );
}

export type WithdrawModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  lendingPairs: LendingPair[];
  combinedBalances: TokenBalance[];
  setIsOpen: (open: boolean) => void;
};

export default function WithdrawModal(props: WithdrawModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, combinedBalances, setIsOpen } = props;
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [activeCollatealOptions, setActiveCollateralOptions] = useState<Token[]>([]);
  const [selectedCollateralOption, setSelectedCollateralOption] = useState<Token | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const network = useNetwork();
  const activeChain = network.chain ?? DEFAULT_CHAIN;

  useEffect(() => {
    const activeCollateralOptions = lendingPairs
      .filter((pair) => pair.token0 === selectedOption || pair.token1 === selectedOption)
      .map((pair) => {
        return pair.token0 === selectedOption ? pair.token1 : pair.token0;
      });
    setActiveCollateralOptions(activeCollateralOptions);
    setSelectedCollateralOption(activeCollateralOptions[0]);
  }, [lendingPairs, selectedOption]);

  useEffect(() => {
    setSelectedOption(defaultOption);
  }, [defaultOption]);

  // Get the active kitty that corresponds to the selected token and is in
  // the selected token / collateral token lending pair
  let activeKitty: Kitty | null = useMemo(() => {
    for (const lendingPair of lendingPairs) {
      if (lendingPair.token0 === selectedOption && lendingPair.token1 === selectedCollateralOption) {
        return lendingPair.kitty0;
      } else if (lendingPair.token1 === selectedOption && lendingPair.token0 === selectedCollateralOption) {
        return lendingPair.kitty1;
      }
    }
    return null;
  }, [selectedCollateralOption, selectedOption, lendingPairs]);

  const activeKittyBalance = combinedBalances.find(
    (balance) => activeKitty && balance.token.address === activeKitty.address
  )?.balance;

  if (selectedCollateralOption == null || activeKitty == null) {
    return null;
  }

  return (
    <PortfolioModal isOpen={isOpen} title='Withdraw' setIsOpen={setIsOpen}>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Asset
            </Text>
          </div>
          <TokenDropdown
            options={options}
            selectedOption={selectedOption}
            onSelect={(option) => {
              setSelectedOption(option);
            }}
            size='L'
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Collateral
          </Text>
          <TokenDropdown
            options={activeCollatealOptions}
            onSelect={setSelectedCollateralOption}
            selectedOption={selectedCollateralOption}
            size='L'
            compact={false}
          />
        </div>
        <TokenAmountInput
          value={inputValue}
          onChange={(value) => setInputValue(value)}
          tokenLabel={selectedOption.ticker}
          max={activeKittyBalance?.toString()}
          maxed={activeKittyBalance?.toString() === inputValue}
        />
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're withdrawing {inputValue || '0.00'} {selectedOption.ticker} from the {selectedOption.ticker}/
            {selectedCollateralOption.ticker} lending market.
          </Text>
        </div>
        <div className='w-full'>
          <WithdrawButton
            withdrawAmount={inputValue}
            withdrawBalance={activeKittyBalance?.toString() ?? '0.00'}
            token={selectedOption}
            kitty={activeKitty}
            activeChain={activeChain}
            setIsOpen={setIsOpen}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By withdrawing, you agree to our <a href='/earn/public/terms.pdf'>Terms of Service</a> and acknowledge that
            you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is your duty to
            educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </PortfolioModal>
  );
}
