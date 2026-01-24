import { fireEvent, render, screen } from '@testing-library/react';
import SearchEmptyState from './index';

describe('SearchEmptyState', () => {
  it('renders empty state and recommendations', () => {
    render(<SearchEmptyState />);

    expect(screen.getByText('Search Results')).toBeInTheDocument();
    expect(screen.getByText('No products found')).toBeInTheDocument();
    expect(screen.getByText('Recommended for You')).toBeInTheDocument();
  });

  it('updates and clears the search input', () => {
    render(<SearchEmptyState />);

    const input = screen.getByPlaceholderText('Search products...');
    fireEvent.change(input, { target: { value: 'New Query' } });
    expect(input).toHaveValue('New Query');

    fireEvent.click(screen.getByText('close'));
    expect(input).toHaveValue('');
  });

  it('shows the demand request call to action', () => {
    render(<SearchEmptyState />);

    expect(screen.getByText('Submit a Demand Request')).toBeInTheDocument();
  });
});
