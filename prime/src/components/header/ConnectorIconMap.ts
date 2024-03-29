import CoinbaseWalletIcon from '../../assets/png/coinbase_wallet_logo.png';
import MetamaskIcon from '../../assets/svg/metamask-fox.svg';
import WalletConnectIcon from '../../assets/svg/walletconnect-logo.svg';

export function mapConnectorNameToIcon(name: string): string {
  switch (name) {
    case 'WalletConnect':
      return WalletConnectIcon;
    case 'Coinbase Wallet':
      return CoinbaseWalletIcon;
    case 'Injected':
    default:
      return MetamaskIcon;
  }
}
