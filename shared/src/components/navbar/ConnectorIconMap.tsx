import CoinbaseWalletIcon from '../../assets/svg/CoinbaseWalletLogo';
import MetaMaskIcon from '../../assets/svg/MetaMaskLogo';
import WalletConnectIcon from '../../assets/svg/WalletConnectLogo';

export function getIconForWagmiConnectorNamed(name: string): JSX.Element {
  switch (name) {
    case 'WalletConnect':
      return <WalletConnectIcon width={40} height={40} />;
    case 'Coinbase Wallet':
      return <CoinbaseWalletIcon width={40} height={40} />;
    case 'Injected':
    default:
      return <MetaMaskIcon width={40} height={40} />;
  }
}
