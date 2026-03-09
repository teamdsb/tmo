import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Taro from '@tarojs/taro';
import SearchEmptyState from './index';
import { commerceServices } from '../../../services/commerce';


const longTitleProducts = [
  {
    id: 'search-long-1',
    name: 'Search Result Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证双列推荐卡布局稳定性',
    coverImageUrl: '',
    tags: ['推荐']
  },
  {
    id: 'search-long-2',
    name: 'Second Search Result Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证双列推荐卡布局稳定性',
    coverImageUrl: '',
    tags: ['推荐']
  }
];

const runDebounce = async () => {
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
};

describe('SearchEmptyState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders empty state and recommendations', async () => {
    render(<SearchEmptyState />);

    await runDebounce();

    expect(screen.getByText(/未找到与/)).toBeInTheDocument();
    expect(screen.getByText('为你推荐')).toBeInTheDocument();
  });


  it('keeps recommendation and result cards rendered for long titles', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async ({ q } = {}) => ({
      items: q ? longTitleProducts : longTitleProducts,
      total: longTitleProducts.length
    }));

    render(<SearchEmptyState />);

    await runDebounce();
    expect(screen.getAllByText('¥185.00 起')).toHaveLength(2);
    expect(document.querySelectorAll('.recommend-card')).toHaveLength(2);

    const input = screen.getByPlaceholderText('搜索商品...');
    fireEvent.change(input, { target: { value: 'long' } });
    await runDebounce();

    expect(screen.getAllByText('¥185.00 起')).toHaveLength(2);
    expect(document.querySelectorAll('.recommend-card')).toHaveLength(2);
  });

  it('keeps shared long-text styles for recommendation titles', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../../app.scss'), 'utf8');

    expect(stylesheet).toContain('.u-safe-title-2');
    expect(stylesheet).toContain('.recommend-card-title');
  });

  it('updates and clears the search input', () => {
    render(<SearchEmptyState />);

    const input = screen.getByPlaceholderText('搜索商品...');
    fireEvent.change(input, { target: { value: 'New Query' } });
    expect(input).toHaveValue('New Query');

    fireEvent.click(screen.getByText('close'));
    expect(input).toHaveValue('');
  });

  it('shows clickable demand hint with kw when no query result', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockImplementation(async ({ q } = {}) => {
      if (q) {
        return { items: [], total: 0 };
      }
      return {
        items: [{ id: 'prod-fallback', name: '推荐商品', coverImageUrl: '', tags: ['推荐'] }],
        total: 1
      };
    });

    render(<SearchEmptyState />);

    const input = screen.getByPlaceholderText('搜索商品...');
    fireEvent.change(input, { target: { value: '轴承' } });

    await runDebounce();

    const hint = screen.getByText('未找到“轴承”？点击发布需求');
    fireEvent.click(hint);

    expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/demand/create/index?kw=%E8%BD%B4%E6%89%BF' });
  });
});
