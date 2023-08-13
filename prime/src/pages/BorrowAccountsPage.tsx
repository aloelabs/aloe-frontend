import { useContext, useEffect, useState } from 'react';

import { ContractCallContext, Multicall } from 'ethereum-multicall';
import { ContractReceipt, ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import AppPage from 'shared/lib/components/common/AppPage';
import { FilledGradientButtonWithIcon } from 'shared/lib/components/common/Buttons';
import { DropdownOption } from 'shared/lib/components/common/Dropdown';
import { AltSpinner } from 'shared/lib/components/common/Spinner';
import { Display } from 'shared/lib/components/common/Typography';
import { base } from 'shared/lib/data/BaseChain';
import { ALOE_II_FACTORY_ADDRESS, MULTICALL_ADDRESS } from 'shared/lib/data/constants/ChainSpecific';
import { NumericFeeTierToEnum, PrintFeeTier } from 'shared/lib/data/FeeTier';
import { useChainDependentState } from 'shared/lib/data/hooks/UseChainDependentState';
import useEffectOnce from 'shared/lib/data/hooks/UseEffectOnce';
import { getToken } from 'shared/lib/data/TokenData';
import { useAccount, useProvider, useSigner, Address } from 'wagmi';

import { ChainContext, useGeoFencing } from '../App';
import UniswapV3PoolABI from '../assets/abis/UniswapV3Pool.json';
import { ReactComponent as PlusIcon } from '../assets/svg/plus.svg';
import ActiveMarginAccounts from '../components/borrow/ActiveMarginAccounts';
import CreatedMarginAccountModal from '../components/borrow/modal/CreatedMarginAccountModal';
import CreateMarginAccountModal from '../components/borrow/modal/CreateMarginAccountModal';
import FailedTxnModal from '../components/borrow/modal/FailedTxnModal';
import PendingTxnModal from '../components/borrow/modal/PendingTxnModal';
import { createBorrower } from '../connector/FactoryActions';
import { UNISWAP_POOL_DENYLIST } from '../data/constants/Addresses';
import { TOPIC0_CREATE_MARKET_EVENT } from '../data/constants/Signatures';
import { fetchMarginAccountPreviews, MarginAccountPreview, UniswapPoolInfo } from '../data/MarginAccount';
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
  const [availablePools, setAvailablePools] = useChainDependentState(
    new Map<string, UniswapPoolInfo>(),
    activeChain.id
  );
  const [marginAccounts, setMarginAccounts] = useChainDependentState<MarginAccountPreview[]>([], activeChain.id);
  const [isLoadingMarginAccounts, setIsLoadingMarginAccounts] = useState(true);
  const [isTxnPending, setIsTxnPending] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);

  // MARK: wagmi hooks
  const provider = useProvider({ chainId: activeChain.id });
  const { address: accountAddress } = useAccount();
  const { data: signer } = useSigner({ chainId: activeChain.id });

  // MARK: react router hooks
  const navigate = useNavigate();

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
      let createMarketLogs: ethers.providers.Log[] = [];
      try {
        // TODO: remove this once the RPC providers (preferably Alchemy) support better eth_getLogs on Base
        if (activeChain.id === base.id) {
          const res = await makeEtherscanRequest(
            2284814,
            ALOE_II_FACTORY_ADDRESS[activeChain.id],
            [TOPIC0_CREATE_MARKET_EVENT],
            true,
            activeChain
          );
          if (res.data.status !== '1') return;
          createMarketLogs = res.data.result;
        } else {
          createMarketLogs = await provider.getLogs({
            fromBlock: 0,
            toBlock: 'latest',
            address: ALOE_II_FACTORY_ADDRESS[activeChain.id],
            topics: [TOPIC0_CREATE_MARKET_EVENT],
          });
        }
      } catch (e) {
        console.error(e);
      }

      const multicall = new Multicall({
        ethersProvider: provider,
        tryAggregate: true,
        multicallCustomContractAddress: MULTICALL_ADDRESS[activeChain.id],
      });
      const marginAccountCallContext: ContractCallContext[] = [];

      createMarketLogs.forEach((e) => {
        const poolAddress = `0x${e.topics[1].slice(-40)}`;

        if (UNISWAP_POOL_DENYLIST.includes(poolAddress.toLowerCase())) return;

        marginAccountCallContext.push({
          reference: poolAddress,
          contractAddress: poolAddress,
          abi: UniswapV3PoolABI,
          calls: [
            {
              reference: 'token0',
              methodName: 'token0',
              methodParameters: [],
            },
            {
              reference: 'token1',
              methodName: 'token1',
              methodParameters: [],
            },
            {
              reference: 'fee',
              methodName: 'fee',
              methodParameters: [],
            },
          ],
        });
      });

      const results = (await multicall.call(marginAccountCallContext)).results;
      const availablePools = new Map<string, UniswapPoolInfo>();
      Object.entries(results).forEach(([poolAddress, result]) => {
        const token0 = result.callsReturnContext[0].returnValues[0] as Address;
        const token1 = result.callsReturnContext[1].returnValues[0] as Address;
        const fee = result.callsReturnContext[2].returnValues[0];
        availablePools.set(poolAddress.toLowerCase(), {
          token0: token0,
          token1: token1,
          fee: fee,
        });
      });
      if (mounted) {
        setAvailablePools(availablePools);
      }
    }

    fetchAvailablePools();
    return () => {
      mounted = false;
    };
  }, [activeChain, provider, setAvailablePools]);

  useEffect(() => {
    let mounted = true;

    async function fetch(userAddress: string) {
      // Guard clause: if the margin account lens contract is null, don't fetch
      if (!isAllowedToInteract) {
        setMarginAccounts([]);
        return;
      }
      try {
        const updatedMarginAccounts = await fetchMarginAccountPreviews(
          activeChain,
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
  }, [activeChain, accountAddress, isAllowedToInteract, provider, refetchCount, availablePools, setMarginAccounts]);

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
        label: `${token0.symbol}/${token1.symbol} ${PrintFeeTier(feeTier)}`,
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
            createBorrower(signer, selectedPool, accountAddress, activeChain, onCommencement, onCompletion);
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
