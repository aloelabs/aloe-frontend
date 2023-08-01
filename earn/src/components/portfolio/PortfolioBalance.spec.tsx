import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import PortfolioBalance from './PortfolioBalance';

describe('PortfolioBalance', () => {
  it('displays placeholder text when errorLoadingPrices is true', () => {
    render(<PortfolioBalance errorLoadingPrices={true} totalUsd={0} weightedAvgApy={0} />);
    const placeholderText = screen.getAllByText('$□□□');
    expect(placeholderText[0]).toBeInTheDocument();
  });

  it('displays the correct value when errorLoadingPrices is false', () => {
    render(<PortfolioBalance errorLoadingPrices={false} totalUsd={100} weightedAvgApy={0} />);
    const placeholderText = screen.getAllByText('$100.00');
    expect(placeholderText[0]).toBeInTheDocument();
  });

  it('displays the correct value when errorLoadingPrices is false and the value is large', () => {
    render(<PortfolioBalance errorLoadingPrices={false} totalUsd={100000000} weightedAvgApy={0} />);
    const placeholderText = screen.getAllByText('$100,000,000.00');
    expect(placeholderText[0]).toBeInTheDocument();
  });

  it('displays the correct value when errorLoadingPrices is false and the value is small', () => {
    render(<PortfolioBalance errorLoadingPrices={false} totalUsd={0.0000000001} weightedAvgApy={0} />);
    const placeholderText = screen.getAllByText('$0.00');
    expect(placeholderText[0]).toBeInTheDocument();
  });

  it('displays the correct value when errorLoadingPrices is false and the value is negative', () => {
    render(<PortfolioBalance errorLoadingPrices={false} totalUsd={-100} weightedAvgApy={0} />);
    expect(screen.getByText('-$100.00')).toBeInTheDocument();
  });

  it('also displays NaN when errorLoadingPrices is false and the value is negative', () => {
    render(<PortfolioBalance errorLoadingPrices={false} totalUsd={-100} weightedAvgApy={0} />);
    expect(screen.getByText('$NaN')).toBeInTheDocument();
  });
});
