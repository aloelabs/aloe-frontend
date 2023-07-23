import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import HealthBar from './HealthBar';

describe('HealthBar', () => {
  it('renders the health label correctly', () => {
    render(<HealthBar health={2.5} />);
    expect(screen.getByText('2.5000')).toBeInTheDocument();
  });

  it('renders the health label with a plus sign when health is greater than MAX_HEALTH_LABEL', () => {
    render(<HealthBar health={6} />);
    expect(screen.getByText('5+')).toBeInTheDocument();
  });

  it('renders the health dial at the correct position when health is equal to MAX_HEALTH_BAR', () => {
    render(<HealthBar health={3} />);
    expect(screen.getByTestId('health-bar-dial')).toHaveStyle('left: 100%');
  });

  it('renders the health dial at the correct position when health is 0', () => {
    render(<HealthBar health={0} />);
    expect(screen.getByTestId('health-bar-dial')).toHaveStyle('left: 0%');
  });

  it('renders the health dial at the correct position when health is 1.5', () => {
    render(<HealthBar health={1.5} />);
    expect(screen.getByTestId('health-bar-dial')).toHaveStyle('left: 40%');
  });

  it('renders the health dial at the correct position when health is 2.5', () => {
    render(<HealthBar health={2.5} />);
    expect(screen.getByTestId('health-bar-dial')).toHaveStyle('left: 80%');
  });

  it('renders the health dial at the correct position when health is 1.25', () => {
    render(<HealthBar health={1.25} />);
    expect(screen.getByTestId('health-bar-dial')).toHaveStyle('left: 30%');
  });
});
