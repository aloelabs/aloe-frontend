import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import OptimizeButton from './OptimizeButton';

describe('OptimizeButton', () => {
  it('renders the button with "Optimize" text when isOptimized is false', () => {
    render(<OptimizeButton isOptimized={false} onClick={() => {}} />);
    expect(screen.getByText('Optimize')).toBeInTheDocument();
  });

  it('renders the button with "Optimized" text when isOptimized is true', () => {
    render(<OptimizeButton isOptimized={true} onClick={() => {}} />);
    expect(screen.getByText('Optimized')).toBeInTheDocument();
  });

  it('calls the onClick function when the button is clicked', () => {
    const handleClick = jest.fn();
    render(<OptimizeButton isOptimized={false} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button when isOptimized is true', () => {
    render(<OptimizeButton isOptimized={true} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
