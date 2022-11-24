import { ReactElement, useEffect, useState } from 'react';

import Big from 'big.js';
import { BigNumber, ethers } from 'ethers';
import { FilledStylizedButton } from 'shared/lib/components/common/Buttons';
import { BaseMaxButton, SquareInput } from 'shared/lib/components/common/Input';
import { Text } from 'shared/lib/components/common/Typography';
import { Chain, useAccount, useBalance, useContractWrite, useNetwork, useProvider } from 'wagmi';

import ERC20ABI from '../../../assets/abis/ERC20.json';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/alert_triangle.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/check_black.svg';
import { ReactComponent as MoreIcon } from '../../../assets/svg/more_ellipses.svg';
import { DEFAULT_CHAIN } from '../../../data/constants/Values';
import { Token } from '../../../data/Token';
import { formatNumberInput, String1E } from '../../../util/Numbers';
import TokenAmountSelectInput from '../TokenAmountSelectInput';
import PortfolioModal from './PortfolioModal';

const SECONDARY_COLOR = '#CCDFED';
const TERTIARY_COLOR = '#4b6980';

enum ConfirmButtonState {
  INVALID_ADDRESS,
  INSUFFICIENT_ASSET,
  PENDING,
  LOADING,
  READY,
}

function getConfirmButton(
  state: ConfirmButtonState,
  token: Token
): { text: string; Icon: ReactElement; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.INVALID_ADDRESS:
      return {
        text: `Invalid Address`,
        Icon: <AlertTriangleIcon />,
        enabled: false,
      };
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return {
        text: `Insufficient ${token.ticker}`,
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

type SendCryptoConfirmButtonProps = {
  sendAddress: string;
  isValidAddress: boolean;
  sendAmount: string;
  sendBalance: string;
  token: Token;
  activeChain: Chain;
  setIsOpen: (isOpen: boolean) => void;
};

function SendCryptoConfirmButton(props: SendCryptoConfirmButtonProps) {
  const { sendAddress, sendAmount, sendBalance, token, activeChain, setIsOpen } = props;
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const provider = useProvider();

  const sendAmountBig = new Big(sendAmount).mul(String1E(token.decimals));

  useEffect(() => {
    let mounted = true;
    async function resolveEns() {
      const resolved = await provider.resolveName(sendAddress);
      if (mounted) {
        setResolvedAddress(resolved);
      }
    }
    // If the address could be valid, resolve it, otherwise set it to null
    if (sendAddress.endsWith('.eth') || sendAddress.length === 42) {
      resolveEns();
    } else {
      setResolvedAddress(null);
    }
    return () => {
      mounted = false;
    };
  }, [sendAddress, provider]);

  const contract = useContractWrite({
    address: token.address,
    abi: ERC20ABI,
    mode: 'recklesslyUnprepared',
    functionName: 'transfer',
    chainId: activeChain.id,
  });

  const numericSendBalance = Number(sendBalance) || 0;
  const numericSendAmount = Number(sendAmount) || 0;

  let confirmButtonState = ConfirmButtonState.READY;

  if (resolvedAddress == null) {
    confirmButtonState = ConfirmButtonState.INVALID_ADDRESS;
  } else if (numericSendAmount > numericSendBalance) {
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
          recklesslySetUnpreparedArgs: [resolvedAddress, sendAmountBig.toFixed()],
          recklesslySetUnpreparedOverrides: { gasLimit: BigNumber.from('600000') },
        })
        .then((txnResult) => {
          setIsOpen(false);
          setIsPending(false);
          // TODO: add txn to pending txns
        })
        .catch((error) => {
          setIsPending(false);
        });
    }
  }

  const isDepositAmountValid = numericSendAmount > 0;
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

export type SendCryptoModalProps = {
  isOpen: boolean;
  options: Token[];
  defaultOption: Token;
  setIsOpen: (open: boolean) => void;
};

export default function SendCryptoModal(props: SendCryptoModalProps) {
  const { isOpen, options, defaultOption, setIsOpen } = props;
  const [selectedOption, setSelectedOption] = useState<Token>(defaultOption);
  const [addressInputValue, setAddressInputValue] = useState<string>('');
  const [sendAmountInputValue, setSendAmountInputValue] = useState<string>('');
  const account = useAccount();
  const network = useNetwork();
  const activeChain = network.chain ?? DEFAULT_CHAIN;

  useEffect(() => {
    setSelectedOption(defaultOption);
  }, [defaultOption]);

  // Get the user's balance of the selected token
  const { data: depositBalance } = useBalance({
    addressOrName: account?.address ?? '',
    token: selectedOption.address,
    watch: true,
  });

  const isValidAddress = ethers.utils.isAddress(addressInputValue) || addressInputValue.endsWith('.eth');
  return (
    <PortfolioModal isOpen={isOpen} title='Send Crypto' setIsOpen={setIsOpen} maxWidth='550px'>
      <div className='flex flex-col items-center justify-center gap-8 w-full mt-2'>
        <div className='w-full'>
          <div className='flex flex-row justify-between mb-1'>
            <Text size='M' weight='bold'>
              Send to
            </Text>
          </div>
          <SquareInput
            size='L'
            value={addressInputValue}
            inputClassName={addressInputValue !== '' ? 'active' : ''}
            onChange={(e) => setAddressInputValue(e.target.value)}
            fullWidth={true}
            paddingRightOverride='24px'
            placeholder='Enter address'
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
                if (depositBalance != null) {
                  setSendAmountInputValue(depositBalance?.formatted);
                }
              }}
            >
              MAX
            </BaseMaxButton>
          </div>
          <TokenAmountSelectInput
            inputValue={sendAmountInputValue}
            onChange={(value) => {
              const output = formatNumberInput(value);
              if (output != null) {
                setSendAmountInputValue(output);
              }
            }}
            options={options}
            onSelect={setSelectedOption}
            selectedOption={selectedOption}
          />
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're sending {sendAmountInputValue || '0.00'} {selectedOption.ticker} to {addressInputValue || '...'}
          </Text>
        </div>
        <div className='w-full'>
          <SendCryptoConfirmButton
            sendAddress={addressInputValue}
            isValidAddress={isValidAddress}
            sendAmount={sendAmountInputValue || '0.00'}
            sendBalance={depositBalance?.formatted ?? '0.00'}
            token={selectedOption}
            activeChain={activeChain}
            setIsOpen={setIsOpen}
          />
          <Text size='XS' color={TERTIARY_COLOR} className='w-full mt-2'>
            By sending, you agree to our <a href='/earn/public/terms.pdf'>Terms of Service</a> and acknowledge that you
            may lose your money. Aloe Labs is not responsible for any losses you may incur. It is your duty to educate
            yourself and be aware of the risks.
          </Text>
        </div>
      </div>
    </PortfolioModal>
  );
}
