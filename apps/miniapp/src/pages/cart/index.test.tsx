import { fireEvent, render, screen } from '@testing-library/react';
import ExcelImportConfirmation from './index';

describe('ExcelImportConfirmation', () => {
  it('renders status summary and action bar', () => {
    render(<ExcelImportConfirmation />);

    expect(screen.getByText('15 Items Found')).toBeInTheDocument();
    expect(screen.getByText('Subtotal (12 items)')).toBeInTheDocument();
  });

  it('renders pending items and allows tab switch', () => {
    render(<ExcelImportConfirmation />);

    expect(screen.getAllByText('Select Spec')).toHaveLength(3);

    const confirmedTab = screen.getByText('Confirmed (12)');
    const confirmedLabel = confirmedTab.closest('label');

    expect(confirmedLabel).not.toBeNull();
    if (!confirmedLabel) {
      throw new Error('Expected confirmed label');
    }
    fireEvent.click(confirmedLabel);

    expect(confirmedLabel).toHaveClass('text-[#137fec]');
  });

  it('shows the cart action button', () => {
    render(<ExcelImportConfirmation />);

    expect(screen.getByText('Add to Cart')).toBeInTheDocument();
  });
});
