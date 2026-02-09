import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Taro from '@tarojs/taro';
import ProductCatalogApp from './index';

const renderCatalog = async () => {
  render(<ProductCatalogApp />);
  await screen.findByText('办公用品');
};

describe('ProductCatalogApp', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders search and product grid', async () => {
    await renderCatalog();

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    const pageRoot = document.querySelector('.page.page-home');
    expect(pageRoot).not.toBeNull();

    expect(screen.getAllByTestId('home-showcase-empty')).toHaveLength(3);
    expect(screen.getByTestId('home-showcase-dots')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('按 SKU 或名称搜索...')).toBeInTheDocument();
    expect(await screen.findByText('办公用品')).toBeInTheDocument();
    expect(screen.getAllByTestId('home-category-item')).toHaveLength(2);
    expect(screen.queryByText('更多')).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findAllByText('价格详见详情')).toHaveLength(4);
  });

  it('updates search input value', async () => {
    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    expect(input).toHaveValue('bolt');
  });

  it('switches to category tab when clicking quick category', async () => {
    await renderCatalog();

    fireEvent.click(await screen.findByText('办公用品'));

    await waitFor(() => {
      expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/category/index' });
    });
  });
});
