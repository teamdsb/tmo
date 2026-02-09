import { fireEvent, render, screen } from '@testing-library/react';
import CategoryPage from './index';

describe('CategoryPage', () => {
  it('renders category page shell and navbar', () => {
    render(<CategoryPage />);

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    expect(screen.getByPlaceholderText('搜索 SKU 或商品...')).toBeInTheDocument();
    expect(screen.getAllByText('办公用品').length).toBeGreaterThan(0);
  });

  it('switches category from sidebar', () => {
    render(<CategoryPage />);

    const safetyEntry = screen.getByText('安全防护');
    fireEvent.click(safetyEntry);

    expect(screen.getByText('保护最重要的资产')).toBeInTheDocument();
  });
});
