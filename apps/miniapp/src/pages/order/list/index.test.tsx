import { fireEvent, render, screen } from '@testing-library/react';
import OrderHistoryApp from './index';

describe('OrderHistoryApp', () => {
  it('renders tabs and order cards', async () => {
    render(<OrderHistoryApp />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by Order ID or Product...')).toBeInTheDocument();
    expect(await screen.findByText('ORD-88291')).toBeInTheDocument();
  });

  it('updates search input value', () => {
    render(<OrderHistoryApp />);

    const input = screen.getByPlaceholderText('Search by Order ID or Product...');
    fireEvent.change(input, { target: { value: 'ORD-88' } });

    expect(input).toHaveValue('ORD-88');
  });

  it('switches active tab', () => {
    render(<OrderHistoryApp />);

    const shippedTab = screen
      .getAllByText('Shipped')
      .find((node) => node.closest('button'));
    const shippedButton = shippedTab ? shippedTab.closest('button') : null;

    expect(shippedButton).not.toBeNull();
    if (!shippedButton) {
      throw new Error('Expected shipped tab button');
    }
    fireEvent.click(shippedButton);

    expect(shippedButton).toHaveClass('text-[#137fec]');
  });
});
