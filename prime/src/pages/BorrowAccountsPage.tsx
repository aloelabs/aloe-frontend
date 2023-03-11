import { useContext, useEffect, useState } from 'react';

import { ContractReceipt, ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { AltSpinner } from 'shared/lib/components/common/Spinner';
import { Display } from 'shared/lib/components/common/Typography';
import { NumericFeeTierToEnum, PrintFeeTier } from 'shared/lib/data/FeeTier';
import { useAccount, useContract, useProvider, useSigner, Address } from 'wagmi';

import { ChainContext, useGeoFencing } from '../App';
import MarginAccountLensABI from '../assets/abis/MarginAccountLens.json';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import ActiveMarginAccounts from '../components/borrow/ActiveMarginAccounts';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';
import { createBorrower } from '../connector/FactoryActions';
import { ALOE_II_BORROWER_LENS_ADDRESS, ALOE_II_FACTORY_ADDRESS } from '../data/constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT } from '../data/constants/Signatures';
import useEffectOnce from '../data/hooks/UseEffectOnce';
import { fetchMarginAccountPreviews, MarginAccountPreview, UniswapPoolInfo } from '../data/MarginAccount';
import { getToken } from '../data/TokenData';
import { makeEtherscanRequest } from '../util/Etherscan';

export default function BorrowAccountsPage() {
  const { activeChain } = useContext(ChainContext);
  const isAllowedToInteract = useGeoFencing(activeChain);
  // MARK: component state
  // --> transaction modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [showSubmittingModal, setShowSubmittingModal] = useState(false);
  // --> other
  const [availablePools, setAvailablePools] = useState(new Map<string, UniswapPoolInfo>());
  const [marginAccounts, setMarginAccounts] = useState<MarginAccountPreview[]>([]);
  const [isLoadingMarginAccounts, setIsLoadingMarginAccounts] = useState(true);
  const [isTxnPending, setIsTxnPending] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: activeChain.id });
  const { address: accountAddress } = useAccount();
  const { data: signer } = useSigner({ chainId: activeChain.id });

  // MARK: react router hooks
  const navigate = useNavigate();

  const borrowerLensContract = useContract({
    address: ALOE_II_BORROWER_LENS_ADDRESS,
    abi: MarginAccountLensABI,
    signerOrProvider: provider,
  });

  useEffectOnce(() => {
    let mounted = true;
    const interval = setInterval(() => {
      // only refetch if the page is visible (i.e. not in the background) to avoid unnecessary requests
      if (mounted && !document.hidden) {
        setRefetchCount((c) => c + 1);
      }
    }, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  });

  // MARK: Fetch all available Uniswap Pools, i.e. any that are associated with a lending pair market
  useEffect(() => {
    let mounted = true;

    async function fetchAvailablePools() {
      const result = await makeEtherscanRequest(
        0,
        ALOE_II_FACTORY_ADDRESS,
        [TOPIC0_CREATE_MARKET_EVENT],
        false,
        activeChain
      );
      const createMarketEvents = result.data.result;

      if (!Array.isArray(createMarketEvents)) return;

      const poolAddresses = createMarketEvents.map((e) => `0x${e.topics[1].slice(-40)}`);
      const poolInfoTuples = await Promise.all(
        poolAddresses.map((addr) => {
          const poolContract = new ethers.Contract(addr, UniswapV3PoolABI, provider);
          return Promise.all([poolContract.token0(), poolContract.token1(), poolContract.fee()]);
        })
      );

      if (mounted)
        setAvailablePools(
          new Map(
            poolAddresses.map((addr, i) => {
              return [
                addr.toLowerCase(),
                {
                  token0: poolInfoTuples[i][0] as Address,
                  token1: poolInfoTuples[i][1] as Address,
                  fee: poolInfoTuples[i][2] as number,
                },
              ];
            })
          )
        );
    }

    fetchAvailablePools();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider]);

  useEffect(() => {
    let mounted = true;

    async function fetch(userAddress: string) {
      // Guard clause: if the margin account lens contract is null, don't fetch
      if (!borrowerLensContract || !isAllowedToInteract) {
        setMarginAccounts([]);
        return;
      }
      try {
        const updatedMarginAccounts = await fetchMarginAccountPreviews(
          activeChain,
          borrowerLensContract,
          provider,
          userAddress,
          availablePools
        );
        if (mounted) {
          setMarginAccounts(updatedMarginAccounts);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) {
          setIsLoadingMarginAccounts(false);
        }
      }
    }
    if (accountAddress) {
      fetch(accountAddress);
    } else {
      setIsLoadingMarginAccounts(false);
    }
    return () => {
      mounted = false;
    };
  }, [activeChain, accountAddress, isAllowedToInteract, borrowerLensContract, provider, refetchCount, availablePools]);

  function onCommencement() {
    setIsTxnPending(false);
    setShowConfirmModal(false);
    setTimeout(() => {
      setShowSubmittingModal(true);
    }, 500);
  }

  function onCompletion(receipt?: ContractReceipt) {
    // Reset state (close out of potentially open modals)
    if (receipt === undefined) {
      setIsTxnPending(false);
      return;
    }
    setShowSubmittingModal(false);
    if (receipt?.status === 1) {
      setTimeout(() => {
        setShowSuccessModal(true);
      }, 500);
    } else {
      setTimeout(() => {
        setShowFailedModal(true);
      }, 500);
    }
  }

  const dropdownOptions: DropdownOption<string>[] = Array.from(availablePools.entries())
    .map(([addr, info]) => {
      const token0 = getToken(activeChain.id, info.token0);
      const token1 = getToken(activeChain.id, info.token1);
      const feeTier = NumericFeeTierToEnum(info.fee);

      if (!token0 || !token1) {
        console.error(`Unfamiliar with tokens in pool ${addr}`);
        console.info(info.token0, info.token1);
        return null;
      }

      return {
        label: `${token0.ticker}/${token1.ticker} ${PrintFeeTier(feeTier)}`,
        value: addr,
      };
    })
    .filter((opt) => opt !== null) as DropdownOption<string>[];

  return (
    <AppPage>
      <div className='flex gap-8 items-center mb-4'>
        <Display size='L' weight='semibold'>
          Your Margin Accounts
        </Display>
        <FilledGradientButtonWithIcon
          Icon={<PlusIcon />}
          position='leading'
          size='S'
          svgColorType='stroke'
          onClick={() => {
            setShowConfirmModal(true);
          }}
          disabled={accountAddress === undefined || !isAllowedToInteract}
        >
          New
        </FilledGradientButtonWithIcon>
      </div>
      <div className='flex items-center justify-start flex-wrap gap-4'>
        {isLoadingMarginAccounts ? (
          <div className='flex items-center justify-center w-full'>
            <AltSpinner size='M' />
          </div>
        ) : (
          <ActiveMarginAccounts marginAccounts={marginAccounts} accountAddress={accountAddress} />
        )}
      </div>
      {availablePools.size > 0 && (
        <CreateMarginAccountModal
          availablePools={dropdownOptions}
          defaultPool={dropdownOptions[0]}
          isOpen={showConfirmModal}
          isTxnPending={isTxnPending}
          setIsOpen={setShowConfirmModal}
          onConfirm={(selectedPool: string | null) => {
            setIsTxnPending(true);
            if (!signer || !accountAddress || !selectedPool || !isAllowedToInteract) {
              return;
            }
            createBorrower(signer, selectedPool, accountAddress, onCommencement, onCompletion);
          }}
        />
      )}
      <CreatedMarginAccountModal
        isOpen={showSuccessModal}
        setIsOpen={setShowSuccessModal}
        onConfirm={() => {
          setShowSuccessModal(false);
          navigate(0);
        }}
      />
      <FailedTxnModal open={showFailedModal} setOpen={setShowFailedModal} />
      <PendingTxnModal open={showSubmittingModal} setOpen={setShowSubmittingModal} />
    </AppPage>
  );
}
