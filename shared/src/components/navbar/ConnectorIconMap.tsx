import CoinbaseWalletIcon from '../../assets/svg/connectors/CoinbaseWalletLogo';
import MetaMaskIcon from '../../assets/svg/connectors/MetaMaskLogo';
import WalletConnectIcon from '../../assets/svg/connectors/WalletConnectLogo';
import RabbyIcon from '../../assets/svg/connectors/RabbyLogo';
import SafeLogo from '../../assets/svg/connectors/SafeLogo';

export function getIconForWagmiConnectorNamed(name: string): JSX.Element {
  switch (name) {
    case 'WalletConnect':
      return <WalletConnectIcon width={40} height={40} />;
    case 'Coinbase Wallet':
      return <CoinbaseWalletIcon width={40} height={40} />;
    case 'MetaMask':
      return <MetaMaskIcon width={40} height={40} />;
    case 'Rabby Wallet':
      return <RabbyIcon width={40} height={40} />;
    case 'Safe':
      return <SafeLogo width={40} height={40} />;
    default:
      return <MetaMaskIcon width={40} height={40} />;
  }
}
