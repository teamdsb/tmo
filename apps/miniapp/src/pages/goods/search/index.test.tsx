import { act, fireEvent, render, screen } from '@testing-library/react';
import SearchEmptyState from './index';

describe('SearchEmptyState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders empty state and recommendations', async () => {
    render(<SearchEmptyState />);

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByText(/未找到与/)).toBeInTheDocument();
    expect(screen.getByText('为你推荐')).toBeInTheDocument();
  });

  it('updates and clears the search input', () => {
    render(<SearchEmptyState />);

    const input = screen.getByPlaceholderText('搜索商品...');
    fireEvent.change(input, { target: { value: 'New Query' } });
    expect(input).toHaveValue('New Query');

    fireEvent.click(screen.getByText('close'));
    expect(input).toHaveValue('');
  });

  it('shows the demand request call to action', () => {
    render(<SearchEmptyState />);

    expect(screen.getByText('提交需求')).toBeInTheDocument();
  });
});
