import { fireEvent, render, screen } from '@testing-library/react';
import CategoryPage from './index';

describe('CategoryPage', () => {
  it('renders category shell with backend categories', async () => {
    render(<CategoryPage />);

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    expect(navbar).toHaveAttribute('data-safe-area', 'top');
    expect(screen.getByPlaceholderText('搜索 SKU 或商品...')).toBeInTheDocument();

    expect((await screen.findAllByText('办公用品')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('工业')).length).toBeGreaterThan(0);
    expect(await screen.findByText('A4 办公用纸')).toBeInTheDocument();
  });

  it('switches active category from sidebar', async () => {
    render(<CategoryPage />);

    const industrialEntry = await screen.findByText('工业');
    fireEvent.click(industrialEntry);

    const sidebarItem = industrialEntry.closest('.category-sidebar-item');
    expect(sidebarItem).not.toBeNull();
    if (!sidebarItem) {
      throw new Error('Expected category sidebar item');
    }
    expect(sidebarItem).toHaveClass('is-active');
    expect(await screen.findByText('共 4 件商品')).toBeInTheDocument();
  });
});
