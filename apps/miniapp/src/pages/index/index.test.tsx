import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Taro from '@tarojs/taro';
import ProductCatalogApp from './index';
import { commerceServices } from '../../services/commerce';

const defaultProducts = [
  { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] },
  { id: 'prod-1002', name: '钢制螺栓套装', coverImageUrl: '', tags: ['工业'] },
  { id: 'prod-1003', name: '控制阀套件', coverImageUrl: '', tags: ['工业'] },
  { id: 'prod-1004', name: '封箱胶带', coverImageUrl: '', tags: ['办公'] }
];

const renderCatalog = async () => {
  render(<ProductCatalogApp />);
  await screen.findByText('办公用品');
};

const runSearchDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
};

describe('ProductCatalogApp', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async () => ({
      items: defaultProducts,
      total: defaultProducts.length
    }));
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

  it('shows demand hint when home search has no result and navigates to demand create', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async ({ q } = {}) => {
      if (q) {
        return { items: [], total: 0 };
      }
      return {
        items: [
          { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] }
        ],
        total: 1
      };
    });

    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: '123' } });

    await runSearchDebounce();

    expect(screen.getByText('未找到“123”？')).toBeInTheDocument();
    const action = screen.getByText('点击发布需求');
    expect(action).toHaveClass('home-empty-demand-action');

    fireEvent.click(action);

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/demand/create/index?kw=123' });
  });

  it('does not show demand hint when home search has matched products', async () => {
    await renderCatalog();

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'A4' } });

    await runSearchDebounce();

    expect(screen.queryByText('点击发布需求')).not.toBeInTheDocument();
  });
});
