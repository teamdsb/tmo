import { fireEvent, render, screen } from '@testing-library/react';
import ProductCatalogApp from './index';

describe('ProductCatalogApp', () => {
  it('renders header, search, and product grid', () => {
    render(<ProductCatalogApp />);

    expect(screen.getByText('Product Catalog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by SKU or Name...')).toBeInTheDocument();
    expect(screen.getAllByText(/SKU:/)).toHaveLength(4);
  });

  it('updates search input value', () => {
    render(<ProductCatalogApp />);

    const input = screen.getByPlaceholderText('Search by SKU or Name...');
    fireEvent.change(input, { target: { value: 'bolt' } });

    expect(input).toHaveValue('bolt');
  });

  it('switches active category on click', () => {
    render(<ProductCatalogApp />);

    const tabLabel = screen.getByText('Office Supplies');
    const tabButton = tabLabel.closest('button');

    expect(tabButton).not.toBeNull();
    if (!tabButton) {
      throw new Error('Expected category tab button');
    }
    fireEvent.click(tabButton);

    expect(tabButton).toHaveClass('text-[#137fec]');
  });
});
