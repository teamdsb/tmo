import { fireEvent, render, screen } from '@testing-library/react';
import ProductDetail from './index';

describe('ProductDetail', () => {
  it('renders product information and shipping', () => {
    render(<ProductDetail />);

    expect(screen.getByText('High-Precision Industrial Control Valve')).toBeInTheDocument();
    expect(screen.getAllByText('$185.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Standard Air Freight')).toBeInTheDocument();
  });

  it('updates material selection', () => {
    render(<ProductDetail />);

    const materialLabel = screen.getByText('Carbon');
    const materialButton = materialLabel.closest('button');

    expect(materialButton).not.toBeNull();
    if (!materialButton) {
      throw new Error('Expected material button');
    }
    fireEvent.click(materialButton);

    expect(materialButton).toHaveClass('bg-[#137fec]');
  });

  it('updates size selection', () => {
    render(<ProductDetail />);

    const sizeLabel = screen.getByText('75mm');
    const sizeButton = sizeLabel.closest('button');

    expect(sizeButton).not.toBeNull();
    if (!sizeButton) {
      throw new Error('Expected size button');
    }
    fireEvent.click(sizeButton);

    expect(sizeButton).toHaveClass('border-[#137fec]');
  });
});
