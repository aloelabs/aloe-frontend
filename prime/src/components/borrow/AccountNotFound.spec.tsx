import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AccountNotFound from './AccountNotFound';

describe('AccountNotFound', () => {
  it('renders the correct text', () => {
    render(<AccountNotFound />);
    expect(screen.getByText('Account not found')).toBeInTheDocument();
    expect(screen.getByText('Please check the provided address and your current network.')).toBeInTheDocument();
  });
});
