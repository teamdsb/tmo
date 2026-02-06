import { act, render, screen } from '@testing-library/react';
import ExcelImportConfirmation from './index';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

const renderCart = async () => {
  render(<ExcelImportConfirmation />);
  await act(async () => {
    await flushPromises();
  });
};

describe('ExcelImportConfirmation', () => {
  it('renders cart summary and items', async () => {
    await renderCart();

    expect(await screen.findByText('示例螺栓')).toBeInTheDocument();
    expect(screen.getByText('数量')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the cart action buttons', async () => {
    await renderCart();

    expect(screen.getByText('继续浏览')).toBeInTheDocument();
    expect(screen.getByText('去结算')).toBeInTheDocument();
  });
});
