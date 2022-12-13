import { ReactElement, useEffect, useState } from 'react';

import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import { Display, Text } from 'shared/lib/components/common/Typography';
import { Chain, useAccount, useBalance, useNetwork } from 'wagmi';

import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../assets/svg/more_ellipses.svg';
import { DEFAULT_CHAIN } from '../../../data/constants/Values';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { TokenQuote } from '../../../pages/PortfolioPage';
import { formatNumberInput } from '../../../util/Numbers';
import TokenDropdown from '../../common/TokenDropdown';
import TokenAmountSelectInput from '../TokenAmountSelectInput';
import PortfolioModal from './PortfolioModal';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_BORROW_ASSET,
  INSUFFICIENT_COLLATERAL_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  borrowToken: Token,
  collateralToken: Token
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INSUFFICIENT_BORROW_ASSET:
      return {
        text: `Insufficient ${borrowToken.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_COLLATERAL_ASSET:
      return {
        text: `Insufficient ${collateralToken.ticker}`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
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

type BorrowCryptoConfirmButtonProps = {
  borrowAmount: string;
  borrowBalance: string;
  borrowToken: Token;
  collateralAmount: string;
  collateralBalance: string;
  collateralToken: Token;
  activeChain: Chain;
  setIsOpen: (isOpen: boolean) => void;
};

function BorrowCryptoConfirmButton(props: BorrowCryptoConfirmButtonProps) {
  const { borrowAmount, borrowBalance, borrowToken, collateralAmount, collateralBalance, collateralToken } = props;
  const [isPending, setIsPending] = useState(false);

  const numericBorrowBalance = Number(borrowBalance) ?? 0;
  const numericBorrowAmount = Number(borrowAmount) ?? 0;
  const numericCollateralBalance = Number(collateralBalance) ?? 0;
  const numericCollateralAmount = Number(collateralAmount) ?? 0;

  let confirmButtonState = ConfirmButtonState.READY;

  if (numericBorrowAmount > numericBorrowBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_BORROW_ASSET;
  } else if (numericCollateralAmount > numericCollateralBalance) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_COLLATERAL_ASSET;
  } else if (isPending) {
    confirmButtonState = ConfirmButtonState.PENDING;
  }

  const confirmButton = getConfirmButton(confirmButtonState, borrowToken, collateralToken);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    if (confirmButtonState === ConfirmButtonState.READY) {
      setIsPending(true);
      // contract
      //   .writeAsync?.({
      //     recklesslySetUnpreparedArgs: [resolvedAddress, sendAmountBig.toFixed()],
      //     recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
      //   })
      //   .then((txnResult) => {
      //     setIsOpen(false);
      //     setIsPending(false);
      //     // TODO: add txn to pending txns
      //   })
      //   .catch((error) => {
      //     setIsPending(false);
      //   });
    }
  }

  const isDepositAmountValid = numericBorrowAmount > 0;
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

function calculateCollateralAmount(
  borrwingToken: Token,
  borrowAmount: string,
  collateral: Token,
  tokenQuotes: TokenQuote[]
): string {
  const borrowingTokenPrice =
    tokenQuotes.find((quote) => quote.token.address === borrwingToken.underlying.address)?.price ?? 0;
  const collateralTokenPrice =
    tokenQuotes.find((quote) => quote.token.address === collateral.underlying.address)?.price ?? 0;
  if (collateralTokenPrice === 0) return '0';
  const ratio = borrowingTokenPrice / collateralTokenPrice;
  // Calculate the number that is the ratio * borrowAmount is 80% of
  const collateralAmount = (parseFloat(borrowAmount) * ratio) / 0.8;
  return isNaN(collateralAmount) ? '' : collateralAmount.toString();
}

export type BorrowCryptoModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  lendingPairs: LendingPair[];
  tokenQuotes: TokenQuote[];
  setIsOpen: (open: boolean) => void;
};

export default function BorrowCryptoModal(props: BorrowCryptoModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, tokenQuotes, setIsOpen } = props;
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [collateralOptions, setCollateralOptions] = useState<Token[]>(() => {
    return lendingPairs
      .filter(
        (pair) =>
          pair.token0.underlying.address === selectedOption.underlying.address ||
          pair.token1.underlying.address === selectedOption.underlying.address
      )
      .map((pair) => {
        return pair.token0.underlying.address === selectedOption.underlying.address ? pair.token1 : pair.token0;
      });
  });
  const [selectedCollateralOption, setSelectedCollateralOption] = useState<Token>(collateralOptions[0]);
  const [borrowAmountInputValue, setBorrowAmountInputValue] = useState<string>('');
  const [collateralAmountInputValue, setCollateralAmountInputValue] = useState<string>('');
  const account = useAccount();
  const network = useNetwork();
  const activeChain = network.chain ?? DEFAULT_CHAIN;

  useEffect(() => {
    setSelectedOption(defaultOption);
  }, [defaultOption]);

  useEffect(() => {
    const updatedCollateralOptions =
      lendingPairs
        .filter(
          (pair) =>
            pair.token0.underlying.address === selectedOption.underlying.address ||
            pair.token1.underlying.address === selectedOption.underlying.address
        )
        .map((pair) => {
          return pair.token0.underlying.address === selectedOption.underlying.address ? pair.token1 : pair.token0;
        }) ?? [];
    setCollateralOptions(updatedCollateralOptions);
    setSelectedCollateralOption(updatedCollateralOptions[0]);
  }, [lendingPairs, selectedOption]);

  useEffect(() => {
    // Calculate the amount of collateral needed to borrow the selected amount of the selected token
    const collateralAmount = calculateCollateralAmount(
      selectedOption,
      borrowAmountInputValue,
      selectedCollateralOption,
      tokenQuotes
    );
    setCollateralAmountInputValue(collateralAmount);
  }, [borrowAmountInputValue, selectedCollateralOption, selectedOption, tokenQuotes]);

  // Get the user's balance of the selected token
  const { data: borrowBalance } = useBalance({
    addressOrName: account?.address ?? '',
    token: selectedOption.address,
    watch: true,
  });

  const { data: collateralBalance } = useBalance({
    addressOrName: account?.address ?? '',
    token: selectedCollateralOption.address,
    watch: true,
  });

  return (
    <PortfolioModal isOpen={isOpen} title='Borrow Crypto' setIsOpen={setIsOpen} maxWidth='550px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                if (borrowBalance != null) {
                  setBorrowAmountInputValue(borrowBalance?.formatted);
                }
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={borrowAmountInputValue}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setBorrowAmountInputValue(output);
              }
            }}
            options={options}
            onSelect={(updatedOption) => {
              setSelectedOption(updatedOption);
              setBorrowAmountInputValue('');
              setCollateralAmountInputValue('');
            }}
            selectedOption={selectedOption}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Collateral
            </Text>
          </div>
          <TokenDropdown
            options={collateralOptions}
            onSelect={setSelectedCollateralOption}
            selectedOption={selectedCollateralOption}
            size='L'
          />
          <div className='flex justify-center'>
            <Display size='S'>
              {collateralAmountInputValue} {selectedCollateralOption.ticker}
            </Display>
          </div>

          <TokenAmountSelectInput
            inputValue={collateralAmountInputValue}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setCollateralAmountInputValue(output);
              }
            }}
            options={collateralOptions}
            selectedOption={selectedCollateralOption}
            onSelect={setSelectedCollateralOption}
            inputDisabled={true}
          />
        </div>

        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're borrowing {borrowAmountInputValue || '0.00'} {selectedOption.ticker} with{' '}
            {collateralAmountInputValue || '0.00'} {selectedCollateralOption.ticker} as collateral.
          </Text>
        </div>
        <div className='w-full'>
          <BorrowCryptoConfirmButton
            borrowAmount={borrowAmountInputValue}
            borrowBalance={borrowBalance?.formatted ?? '0'}
            borrowToken={selectedOption}
            collateralAmount={collateralAmountInputValue}
            collateralBalance={collateralBalance?.formatted ?? '0'}
            collateralToken={selectedCollateralOption}
            activeChain={activeChain}
            setIsOpen={setIsOpen}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By borrowing, you agree to our <a href='/earn/public/terms.pdf'>Terms of Service</a> and acknowledge that
            you may lose your money. Aloe Labs is not responsible for any losses you may incur. It is your duty to
            educate yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </PortfolioModal>
  );
}
