import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import InfoIcon from 'shared/lib/assets/svg/Info';

import PortfolioActionButton from './PortfolioActionButton';

describe('PortfolioActionButton', () => {
  it('renders the label and icon', () => {
    render(<PortfolioActionButton Icon={<InfoIcon data-testid='InfoIcon' />} label='Info' onClick={() => {}} />);
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByTestId('InfoIcon')).toBeInTheDocument();
  });

  it('calls the onClick function when clicked', () => {
    const onClick = jest.fn();
    render(<PortfolioActionButton Icon={<InfoIcon />} label='Info' onClick={onClick} />);
    fireEvent.click(screen.getByText('Info'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when disabled is true', () => {
    const onClick = jest.fn();
    render(<PortfolioActionButton Icon={<InfoIcon />} label='Info' onClick={onClick} disabled={true} />);
    fireEvent.click(screen.getByText('Info'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
