import { act, render, screen } from '@testing-library/react';
import ExcelImportConfirmation from './index';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

const renderCart = async () => {
  render(<ExcelImportConfirmation />);
  await act(async () => {
    await flushPromises();
  });
};

describe('ExcelImportConfirmation', () => {
  it('renders cart summary and items', async () => {
    await renderCart();

    expect(await screen.findByText('Sample Bolt')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders bulk import entry point', async () => {
    await renderCart();

    expect(screen.getByText('Bulk Import')).toBeInTheDocument();
  });

  it('shows the cart action buttons', async () => {
    await renderCart();

    expect(screen.getByText('Continue Browsing')).toBeInTheDocument();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
  });
});
