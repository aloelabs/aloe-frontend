import { useMemo } from 'react';

import { Bridge } from '@socket.tech/plugin';
import { ethers } from 'ethers';
import Modal from 'shared/lib/components/common/Modal';
import { BRIDGE_SUPPORTED_CHAINS } from 'shared/lib/data/constants/ChainSpecific';
import { GREY_800, GREY_900 } from 'shared/lib/data/constants/Colors';
import useChain from 'shared/lib/data/hooks/UseChain';
import { Token } from 'shared/lib/data/Token';
import { getTokens } from 'shared/lib/data/TokenData';
import { mainnet } from 'wagmi/chains';

export type BridgeModalProps = {
  isOpen: boolean;
  selectedAsset: Token;
  setIsOpen: (isOpen: boolean) => void;
};

export default function BridgeModal(props: BridgeModalProps) {
  const { isOpen, selectedAsset, setIsOpen } = props;
  const activeChain = useChain();
  // @ts-ignore
  const provider = new ethers.providers.Web3Provider(window.ethereum as any);

  const supportedChainIds = BRIDGE_SUPPORTED_CHAINS.map((chain) => chain.id);
  const tokens = useMemo(() => {
    return supportedChainIds
      .map((chainId) =>
        getTokens(chainId).map((token) => {
          return { ...token };
        })
      )
      .flat();
  }, [supportedChainIds]);

  if (!provider) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} maxWidth='400px'>
      <Bridge
        provider={provider}
        API_KEY={process.env.REACT_APP_SOCKET_API_KEY!}
        customize={{
          primary: GREY_800,
          secondary: GREY_900,
          onInteractive: 'rgb(255, 255, 255)',
          text: 'rgb(255, 255, 255)',
          secondaryText: 'rgb(255, 255, 255)',
          interactive: GREY_900,
          fontFamily: 'Satoshi-Variable',
        }}
        defaultSourceNetwork={mainnet.id}
        defaultDestNetwork={activeChain.id}
        sourceNetworks={supportedChainIds}
        destNetworks={supportedChainIds}
        tokenList={tokens}
        defaultDestToken={selectedAsset.address}
      />
    </Modal>
  );
}
