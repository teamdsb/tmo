import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { commerceServices } from '../../services/commerce';
import CategoryPage from './index';

describe('CategoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] },
        { id: 'prod-1002', name: '钢制螺栓套装', coverImageUrl: '', tags: ['工业'] },
        { id: 'prod-1003', name: '控制阀套件', coverImageUrl: '', tags: ['工业'] },
        { id: 'prod-1004', name: '封箱胶带', coverImageUrl: '', tags: ['办公'] }
      ],
      total: 4
    });
  });
  it('renders category shell with backend categories', async () => {
    render(<CategoryPage />);

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    expect(screen.getByPlaceholderText('按 SKU 或名称搜索...')).toBeInTheDocument();
    expect(document.querySelector('.category-header-action')).toBeNull();

    expect((await screen.findAllByText('紧固件')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('电气')).length).toBeGreaterThan(0);
    expect(await screen.findByText('全部商品')).toBeInTheDocument();
    expect(await screen.findByText('A4 办公用纸')).toBeInTheDocument();
    expect(await screen.findAllByText('¥185.00 起')).toHaveLength(4);
  });


  it('keeps category product cards rendered for long titles', async () => {
    (commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({
      items: [
        { id: 'cat-long-1', name: 'Category Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证双列布局稳定性', coverImageUrl: '', tags: ['工业'] },
        { id: 'cat-long-2', name: 'Another Category Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证双列布局稳定性', coverImageUrl: '', tags: ['工业'] }
      ],
      total: 2
    });

    render(<CategoryPage />);

    expect((await screen.findAllByText(/Category Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/)).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.category-product-card')).toHaveLength(2);
  });

  it('keeps shared long-text styles for category product titles', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, './index.scss'), 'utf8');
    const searchStylesheet = fs.readFileSync(path.resolve(__dirname, '../../components/home-search-input/index.scss'), 'utf8');

    expect(stylesheet).toContain('.category-product-title');
    expect(stylesheet).toContain('-webkit-line-clamp: 2;');
    expect(stylesheet).toContain('overflow-wrap: anywhere;');
    expect(stylesheet).toContain('.category-secondary-nav-inner');
    expect(stylesheet).toContain('min-width: max-content;');
    expect(stylesheet).toContain('flex: 0 0 auto;');
    expect(stylesheet).toContain('white-space: nowrap;');
    expect(stylesheet).toContain('.category-secondary-nav');
    expect(stylesheet).toContain('border-top: 1px solid #eef2f6;');
    expect(stylesheet).toContain('padding: 20px 0 22px;');
    expect(stylesheet).toContain('gap: 14px;');
    expect(stylesheet).toContain('height: 42px;');
    expect(stylesheet).toContain('padding: 0 18px;');
    expect(stylesheet).toContain('font-size: calc(24rpx + var(--font-size-step-rpx, 0rpx));');
    expect(stylesheet).toContain('.category-primary-label');
    expect(stylesheet).toContain('font-size: calc(18rpx + var(--font-size-step-rpx, 0rpx));');
    expect(stylesheet).toContain('.category-primary-item');
    expect(stylesheet).toContain('min-width: 96px;');
    expect(stylesheet).toContain('gap: 18px;');
    expect(stylesheet).toContain('padding: 24px 16px 22px;');
    expect(stylesheet).toContain('width: 36px;');
    expect(stylesheet).toContain('height: 8px;');
    expect(searchStylesheet).toContain('.home-search-shell');
    expect(searchStylesheet).toContain('.home-search-input');
    expect(searchStylesheet).toContain('.home-search-placeholder');
  });

  it('switches active category from sidebar', async () => {
    render(<CategoryPage />);

    const electricalEntry = await screen.findByText('电气');
    fireEvent.click(electricalEntry);

    const categoryItem = electricalEntry.closest('.category-primary-item');
    expect(categoryItem).not.toBeNull();
    if (!categoryItem) {
      throw new Error('Expected category primary item');
    }
    expect(categoryItem).toHaveClass('is-active');
    expect(await screen.findByText('4 ITEMS')).toBeInTheDocument();
  });

  it('reuses home search input and queries products with q', async () => {
    render(<CategoryPage />);

    const input = screen.getByPlaceholderText('按 SKU 或名称搜索...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    await waitFor(() => {
      expect(commerceServices.catalog.listProducts).toHaveBeenLastCalledWith({
        categoryId: 'fasteners',
        q: 'bolt',
        page: 1,
        pageSize: 40
      });
    });
  });
});
