import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByPlaceholderText('搜索 SKU 或商品...')).toBeInTheDocument();

    expect((await screen.findAllByText('紧固件')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('电气')).length).toBeGreaterThan(0);
    expect(await screen.findByText('A4 办公用纸')).toBeInTheDocument();
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

    expect(stylesheet).toContain('.category-product-title');
    expect(stylesheet).toContain('-webkit-line-clamp: 2;');
    expect(stylesheet).toContain('overflow-wrap: anywhere;');
  });

  it('switches active category from sidebar', async () => {
    render(<CategoryPage />);

    const electricalEntry = await screen.findByText('电气');
    fireEvent.click(electricalEntry);

    const sidebarItem = electricalEntry.closest('.category-sidebar-item');
    expect(sidebarItem).not.toBeNull();
    if (!sidebarItem) {
      throw new Error('Expected category sidebar item');
    }
    expect(sidebarItem).toHaveClass('is-active');
    expect(await screen.findByText('共 4 件商品')).toBeInTheDocument();
  });
});
