import { render, screen } from '@testing-library/react';
import ExcelImportConfirmation from './index';

describe('ExcelImportConfirmation', () => {
  it('renders cart summary and items', async () => {
    render(<ExcelImportConfirmation />);

    expect(await screen.findByText('Sample Bolt')).toBeInTheDocument();
    expect(screen.getByText('Qty: 2')).toBeInTheDocument();
  });

  it('renders bulk import entry point', () => {
    render(<ExcelImportConfirmation />);

    expect(screen.getByText('Bulk Import')).toBeInTheDocument();
  });

  it('shows the cart action buttons', () => {
    render(<ExcelImportConfirmation />);

    expect(screen.getByText('Continue Browsing')).toBeInTheDocument();
    expect(screen.getByText('Checkout')).toBeInTheDocument();
  });
});
