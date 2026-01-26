import { act, fireEvent, render, screen } from '@testing-library/react';
import ProductCatalogApp from './index';

const renderCatalog = async () => {
  render(<ProductCatalogApp />);
  await screen.findByText('Office Supplies');
};

describe('ProductCatalogApp', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders search and product grid', async () => {
    await renderCatalog();

    expect(screen.getByPlaceholderText('Search by SKU or Name...')).toBeInTheDocument();
    expect(await screen.findByText('Office Supplies')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findAllByText(/ID:/)).toHaveLength(4);
  });

  it('updates search input value', async () => {
    await renderCatalog();

    const input = screen.getByPlaceholderText('Search by SKU or Name...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    expect(input).toHaveValue('bolt');
  });

  it('switches active category on click', async () => {
    await renderCatalog();

    const tabLabel = await screen.findByText('Office Supplies');
    const tabButton = tabLabel.closest('button');

    expect(tabButton).not.toBeNull();
    if (!tabButton) {
      throw new Error('Expected category tab button');
    }
    fireEvent.click(tabButton);

    expect(tabButton).toHaveClass('text-[#137fec]');
  });
});
