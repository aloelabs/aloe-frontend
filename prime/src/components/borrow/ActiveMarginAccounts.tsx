import { Text } from 'shared/lib/components/common/Typography';
import { MarginAccountPreview } from 'shared/lib/data/MarginAccount';

import { MarginAccountCard } from './MarginAccountCard';

export type ActiveMarginAccountsProps = {
  marginAccounts: MarginAccountPreview[];
  accountAddress?: string;
};

export default function ActiveMarginAccounts(props: ActiveMarginAccountsProps) {
  const { marginAccounts, accountAddress } = props;
  if (!accountAddress) {
    return (
      <Text size='M' weight='bold'>
        Please connect your wallet to get started.
      </Text>
    );
  }
  return (
    <div className='flex items-center justify-start flex-wrap gap-4'>
      {marginAccounts.length > 0 ? (
        marginAccounts.map((marginAccount, index) => <MarginAccountCard key={index} {...marginAccount} />)
      ) : (
        <Text size='M' weight='bold'>
          Looks like you don't have any active margin accounts. Click the button above to create one.
        </Text>
      )}
    </div>
  );
}
