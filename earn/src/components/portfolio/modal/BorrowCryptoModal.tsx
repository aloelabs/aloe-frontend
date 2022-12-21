import { ReactElement, useEffect, useMemo, useState } from 'react';

import { SendTransactionResult } from '@wagmi/core';
import Big from 'big.js';
import { Contract, ContractReceipt, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import { Chain, useAccount, useBalance, useNetwork, useSigner } from 'wagmi';

import BorrowerABI from '../../../assets/abis/Borrower.json';
import BorrowManagerABI from '../../../assets/abis/BorrowManager.json';
import FactoryABI from '../../../assets/abis/Factory.json';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../assets/svg/more_ellipses.svg';
import { createMarginAccount } from '../../../connector/FactoryActions';
import { getBorrowersForUser } from '../../../data/Borrower';
import { ALOE_II_FACTORY_ADDRESS_WITH_FAUCET_GOERLI } from '../../../data/constants/Addresses';
import { DEFAULT_CHAIN } from '../../../data/constants/Values';
import { LendingPair } from '../../../data/LendingPair';
import { Token } from '../../../data/Token';
import { TokenQuote } from '../../../pages/PortfolioPage';
import { formatNumberInput } from '../../../util/Numbers';
import TokenAmountSelectInput from '../TokenAmountSelectInput';
import PortfolioModal from './PortfolioModal';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INSUFFICIENT_BORROW_ASSET,
  INSUFFICIENT_COLLATERAL_ASSET,
  PENDING,
  CREATING_BORROWER,
  CREATE_BORROWER,
  LOADING,
  READY,
}

enum InputType {
  BORROW,
  COLLATERAL,
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
    case ConfirmButtonState.CREATE_BORROWER:
      return { text: 'Create Borrower', Icon: <MoreIcon />, enabled: true };
    case ConfirmButtonState.CREATING_BORROWER:
      return { text: 'Creating Borrower', Icon: <MoreIcon />, enabled: false };
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
  accountAddress: string;
  activeChain: Chain;
  setIsOpen: (isOpen: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

function BorrowCryptoConfirmButton(props: BorrowCryptoConfirmButtonProps) {
  const {
    borrowAmount,
    borrowBalance,
    borrowToken,
    collateralAmount,
    collateralBalance,
    collateralToken,
    accountAddress,
    // activeChain,
    // setIsOpen,
    // setPendingTxn,
  } = props;
  const [isPending, setIsPending] = useState(false);
  const [borrowerAddress, setBorrowerAddress] = useState<string | undefined>(undefined);

  const { data: signer } = useSigner();

  // const {
  //   write: writeContract,
  //   isLoading: contractIsLoading,
  //   isSuccess: contractDidSucceed,
  //   data: contractData,
  // } = useContractWrite({
  //   abi: BorrowManagerABI,
  //   address: borrowerAddress,
  //   mode: 'recklesslyUnprepared',
  //   functionName: 'callback',
  //   chainId: activeChain.id,
  // });

  const borrowManager = useMemo(() => {
    return signer && borrowerAddress ? new Contract(borrowerAddress, BorrowManagerABI, signer) : null;
  }, [signer, borrowerAddress]);

  // TODO: Temporarily replacing actual factory with one that has a built-in faucet upon MarginAccount creation
  const factory = useMemo(() => {
    return signer ? new Contract(ALOE_II_FACTORY_ADDRESS_WITH_FAUCET_GOERLI, FactoryABI, signer) : null;
  }, [signer]);

  const borrower = useMemo(() => {
    return signer && borrowerAddress ? new Contract(borrowerAddress, BorrowerABI, signer) : null;
  }, [borrowerAddress, signer]);

  console.log('borrower', borrower);

  useEffect(() => {
    async function fetch() {
      const addresses = await getBorrowersForUser(accountAddress);
      if (addresses.length > 0) {
        setBorrowerAddress(addresses[0]);
      }
      console.log('addresses', addresses);
    }
    fetch();
  }, [accountAddress]);

  // useEffect(() => {
  //   if (contractDidSucceed && contractData) {
  //     setPendingTxn(contractData);
  //     setIsPending(false);
  //     setIsOpen(false);
  //   } else if (!contractIsLoading && !contractDidSucceed) {
  //     setIsPending(false);
  //   }
  // }, [contractDidSucceed, contractData, contractIsLoading, setPendingTxn, setIsOpen]);

  // if (factory) {
  //   createMarginAccount(
  //     factory,
  //     '0xfBe57C73A82171A773D3328F1b563296151be515',
  //     accountAddress,
  //     (receipt: ContractReceipt | undefined) => {
  //       console.log('receipt', receipt);
  //     }
  //   );
  // }

  const needsToCreateBorrower = borrowerAddress === undefined;

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
  } else if (needsToCreateBorrower && factory !== null) {
    confirmButtonState = ConfirmButtonState.CREATE_BORROWER;
  }

  const confirmButton = getConfirmButton(confirmButtonState, borrowToken, collateralToken);

  function handleClickConfirm() {
    // TODO: Do not use setStates in async functions outside of useEffect
    if (confirmButtonState === ConfirmButtonState.READY) {
      // setIsPending(true);
      let transactionOptions: any = {};
      transactionOptions['gasLimit'] = 1000000;
      const bigAmount0 = new Big(0.01).mul(10 ** 18);
      const amount1 = 0;
      const action = 0;
      const encodedAction = ethers.utils.defaultAbiCoder.encode(['uint8'], [action]);
      const encodedBigAmount0 = ethers.utils.defaultAbiCoder.encode(['uint256'], [bigAmount0.toFixed(0)]);
      const encodedAmount1 = ethers.utils.defaultAbiCoder.encode(['uint256'], [amount1]);
      borrower?.modify(
        borrowManager?.address,
        ethers.utils.defaultAbiCoder.encode(
          ['uint8[]', 'uint256[]', 'uint256[]'],
          [[encodedAction], [encodedBigAmount0], [encodedAmount1]]
        ),
        [false, false, false, false],
        transactionOptions
      );

      // writeContract?.({
      //   recklesslySetUnpreparedArgs: [factory?.address],
      //   recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
      // });
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
    } else if (confirmButtonState === ConfirmButtonState.CREATE_BORROWER && factory !== null) {
      // TODO: Do not use setStates in async functions outside of useEffect
      setIsPending(true);
      // TODO: Do not use setStates in async functions outside of useEffect
      // TODO: Do not use setStates in async functions outside of useEffect
      // TODO: Do not use setStates in async functions outside of useEffect
      createMarginAccount(
        factory,
        '0xfBe57C73A82171A773D3328F1b563296151be515',
        accountAddress,
        (receipt: ContractReceipt | undefined) => {
          console.log('receipt', receipt);
          //TODO: move this to a useEffect
          setIsPending(false);
        }
      );
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
  // Calculate the callateral amount from the borrow amount
  const collateralAmount = (parseFloat(borrowAmount) * ratio) / 0.8;
  return isNaN(collateralAmount) ? '' : collateralAmount.toString();
}

function calculateBorrowAmount(
  collateralToken: Token,
  collateralAmount: string,
  borrowing: Token,
  tokenQuotes: TokenQuote[]
): string {
  const collateralTokenPrice =
    tokenQuotes.find((quote) => quote.token.address === collateralToken.underlying.address)?.price ?? 0;
  const borrowingTokenPrice =
    tokenQuotes.find((quote) => quote.token.address === borrowing.underlying.address)?.price ?? 0;
  if (collateralTokenPrice === 0) return '0';
  const ratio = collateralTokenPrice / borrowingTokenPrice;
  // Calculate the borrow amount from the collateral amount
  const borrowAmount = parseFloat(collateralAmount) * ratio * 0.8;
  return isNaN(borrowAmount) ? '' : borrowAmount.toString();
}

export type BorrowCryptoModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  lendingPairs: LendingPair[];
  tokenQuotes: TokenQuote[];
  setIsOpen: (open: boolean) => void;
  setPendingTxn: (pendingTxn: SendTransactionResult | null) => void;
};

export default function BorrowCryptoModal(props: BorrowCryptoModalProps) {
  const { isOpen, options, defaultOption, lendingPairs, tokenQuotes, setIsOpen, setPendingTxn } = props;
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
  // Keep track of which input was last changed
  const [lastChangedInput, setLastChangedInput] = useState<InputType | null>(null);
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
    // If the last changed input was the borrow amount, update the collateral amount
    if (lastChangedInput === InputType.BORROW) {
      const collateralAmount = calculateCollateralAmount(
        selectedOption,
        borrowAmountInputValue,
        selectedCollateralOption,
        tokenQuotes
      );
      setCollateralAmountInputValue(collateralAmount);
    }
    // Calculate the amount of collateral needed to borrow the selected amount of the selected token
    // const collateralAmount = calculateCollateralAmount(
    //   selectedOption,
    //   borrowAmountInputValue,
    //   selectedCollateralOption,
    //   tokenQuotes
    // );
    // setCollateralAmountInputValue(collateralAmount);
  }, [borrowAmountInputValue, lastChangedInput, selectedCollateralOption, selectedOption, tokenQuotes]);

  useEffect(() => {
    // If the last changed input was the collateral amount, update the borrow amount
    if (lastChangedInput === InputType.COLLATERAL) {
      const borrowAmount = calculateBorrowAmount(
        selectedCollateralOption,
        collateralAmountInputValue,
        selectedOption,
        tokenQuotes
      );
      setBorrowAmountInputValue(borrowAmount);
    }
    // Calculate the borrow amount needed to get the selected amount of collateral
    // const borrowAmount = calculateBorrowAmount(
    //   selectedCollateralOption,
    //   collateralAmountInputValue,
    //   selectedOption,
    //   tokenQuotes
    // );
    // setBorrowAmountInputValue(borrowAmount);
  }, [collateralAmountInputValue, lastChangedInput, selectedCollateralOption, selectedOption, tokenQuotes]);

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
              Collateral
            </Text>
          </div>
          <TokenAmountSelectInput
            inputValue={collateralAmountInputValue}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setLastChangedInput(InputType.COLLATERAL);
                setCollateralAmountInputValue(output);
              }
            }}
            options={collateralOptions}
            selectedOption={selectedCollateralOption}
            onSelect={setSelectedCollateralOption}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Amount
            </Text>
            <BaseMaxButton
              size='L'
              onClick={() => {
                if (borrowBalance != null) {
                  setLastChangedInput(InputType.BORROW);
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
                setLastChangedInput(InputType.BORROW);
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
            accountAddress={account?.address ?? '0x'}
            activeChain={activeChain}
            setIsOpen={setIsOpen}
            setPendingTxn={setPendingTxn}
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
