import { fireEvent, render, screen } from '@testing-library/react';
import ProductDetail from './index';

const setRouterParams = (params: Record<string, string>) => {
  (globalThis as any).__setTaroRouterParams?.(params);
};

describe('ProductDetail', () => {
  beforeEach(() => {
    setRouterParams({ id: 'spu-1' });
  });

  afterEach(() => {
    setRouterParams({});
  });

  it('renders product information and shipping', async () => {
    render(<ProductDetail />);

    expect((await screen.findAllByText('High-Precision Industrial Control Valve')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('¥185.00').length).toBeGreaterThan(0);
    expect(screen.getByText('Standard Air Freight')).toBeInTheDocument();
  });

  it('updates material selection', async () => {
    render(<ProductDetail />);

    const materialLabel = await screen.findByText('Carbon');
    const materialButton = materialLabel.closest('button');

    expect(materialButton).not.toBeNull();
    if (!materialButton) {
      throw new Error('Expected material button');
    }
    fireEvent.click(materialButton);

    expect(materialButton).toHaveClass('bg-[#137fec]');
  });

  it('updates size selection', async () => {
    render(<ProductDetail />);

    const sizeLabel = await screen.findByText('75mm');
    const sizeButton = sizeLabel.closest('button');

    expect(sizeButton).not.toBeNull();
    if (!sizeButton) {
      throw new Error('Expected size button');
    }
    fireEvent.click(sizeButton);

    expect(sizeButton).toHaveClass('border-[#137fec]');
  });
});
