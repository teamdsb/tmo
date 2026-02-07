import { act, fireEvent, render, screen } from '@testing-library/react';
import ProductCatalogApp from './index';

const renderCatalog = async () => {
  render(<ProductCatalogApp />);
  await screen.findByText('办公用品');
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

    expect(screen.getByTestId('home-showcase-empty')).toBeInTheDocument();
    expect(screen.getByTestId('home-showcase-dots')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('按 SKU 或名称搜索...')).toBeInTheDocument();
    expect(await screen.findByText('办公用品')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findAllByText(/编号：/)).toHaveLength(4);
  });

  it('updates search input value', async () => {
    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    expect(input).toHaveValue('bolt');
  });

  it('switches active category on click', async () => {
    await renderCatalog();

    const tabLabel = await screen.findByText('办公用品');
    const tabButton = tabLabel.closest('button');

    expect(tabButton).not.toBeNull();
    if (!tabButton) {
      throw new Error('Expected category tab button');
    }
    fireEvent.click(tabButton);

    expect(tabButton).toHaveClass('text-[#137fec]');
  });
});
