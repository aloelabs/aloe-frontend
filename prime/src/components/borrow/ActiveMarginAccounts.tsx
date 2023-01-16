import { Text } from 'shared/lib/components/common/Typography';

import { MarginAccountPreview } from '../../data/MarginAccount';
import { MarginAccountCard } from './MarginAccountCard';

export type ActiveMarginAccountsProps = {
  marginAccounts: MarginAccountPreview[];
};

export default function ActiveMarginAccounts(props: ActiveMarginAccountsProps) {
  const { marginAccounts } = props;
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
