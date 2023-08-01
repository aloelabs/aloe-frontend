import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AccountStatsCard } from './AccountStatsCard';

describe('AccountStatsCard', () => {
  it('renders the label and value', () => {
    render(<AccountStatsCard label='Label' value='Value' showAsterisk={false} />);
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders the asterisk when showAsterisk is true', () => {
    render(<AccountStatsCard label='Label' value='Value' showAsterisk={true} />);
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders denomination when provided', () => {
    render(<AccountStatsCard label='Label' value='Value' denomination='Denomination' showAsterisk={false} />);
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Denomination')).toBeInTheDocument();
  });

  it('renders boxColor when provided', () => {
    render(<AccountStatsCard label='Label' value='Value' boxColor='red' showAsterisk={false} />);
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByTestId('Box')).toHaveStyle('background-color: red');
  });
});
