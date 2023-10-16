import { useContext, useEffect, useState } from 'react';

import { FilledGradientButton } from 'shared/lib/components/common/Buttons';
import Modal from 'shared/lib/components/common/Modal';
import TokenAmountInput from 'shared/lib/components/common/TokenAmountInput';
import Tooltip from 'shared/lib/components/common/Tooltip';
import { Text } from 'shared/lib/components/common/Typography';
import { GN, GNFormat } from 'shared/lib/data/GoodNumber';
import { formatNumberInput, roundPercentage } from 'shared/lib/util/Numbers';
import { useAccount, useBalance } from 'wagmi';

import { ChainContext } from '../../../App';
import { TokenIconsWithTooltip } from '../../common/TokenIconsWithTooltip';
import { SupplyTableRow } from '../SupplyTable';

const SECONDARY_COLOR = 'rgba(130, 160, 182, 1)';

enum ConfirmButtonState {
  WAITING_FOR_USER,
  READY,
  LOADING,
  INSUFFICIENT_ASSET,
  DISABLED,
}

function getConfirmButton(state: ConfirmButtonState): { text: string; enabled: boolean } {
  switch (state) {
    case ConfirmButtonState.WAITING_FOR_USER:
      return { text: 'Check Wallet', enabled: false };
    case ConfirmButtonState.READY:
      return { text: 'Confirm', enabled: true };
    case ConfirmButtonState.LOADING:
      return { text: 'Loading', enabled: false };
    case ConfirmButtonState.INSUFFICIENT_ASSET:
      return { text: 'Insufficient Asset', enabled: false };
    case ConfirmButtonState.DISABLED:
    default:
      return { text: 'Confirm', enabled: false };
  }
}

export type SupplyModalProps = {
  isOpen: boolean;
  selectedRow: SupplyTableRow;
  setIsOpen: (isOpen: boolean) => void;
};

export default function SupplyModal(props: SupplyModalProps) {
  const { isOpen, selectedRow, setIsOpen } = props;
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

  let confirmButtonState: ConfirmButtonState;
  if (supplyAmount.gt(userBalance)) {
    confirmButtonState = ConfirmButtonState.INSUFFICIENT_ASSET;
  } else if (amount === '') {
    confirmButtonState = ConfirmButtonState.DISABLED;
  } else {
    confirmButtonState = ConfirmButtonState.READY;
  }

  const confirmButton = getConfirmButton(confirmButtonState);

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
          <Text size='L' weight='bold' color={SECONDARY_COLOR}>
            {apyPercentage}%
          </Text>
        </div>
        <div className='flex flex-col gap-1 w-full'>
          <Text size='M' weight='bold'>
            Summary
          </Text>
          <Text size='XS' color={SECONDARY_COLOR} className='overflow-hidden text-ellipsis'>
            You're supplying {amount} {selectedRow.asset.symbol} that users can borrow in exchange for{' '}
            {formattedCollateral}. You will earn a variable <strong>{apyPercentage}%</strong> APY on your supplied{' '}
            {selectedRow.asset.symbol}.
          </Text>
        </div>
        <FilledGradientButton size='M' fillWidth={true} disabled={!confirmButton.enabled}>
          {confirmButton.text}
        </FilledGradientButton>
      </div>
    </Modal>
  );
}
