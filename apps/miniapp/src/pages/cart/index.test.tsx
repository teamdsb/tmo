import { act, render, screen } from '@testing-library/react';
import ExcelImportConfirmation from './index';
import { commerceServices } from '../../services/commerce';

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

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();
    expect(navbar).toHaveAttribute('data-safe-area', 'top');

    expect(await screen.findByText('示例螺栓')).toBeInTheDocument();
    expect(screen.getByText('数量')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows the cart action buttons', async () => {
    await renderCart();

    expect(screen.getByText('继续浏览')).toBeInTheDocument();
    expect(screen.getByText('去结算')).toBeInTheDocument();
  });

  it('shows a single empty-state title and count summary when cart is empty', async () => {
    (commerceServices.cart.getCart as jest.Mock).mockResolvedValueOnce({ items: [] });

    await renderCart();

    expect(screen.getByText('共 0 件')).toBeInTheDocument();
    expect(screen.getAllByText('购物车为空')).toHaveLength(1);
    expect(screen.getByText('先去首页挑选商品吧')).toBeInTheDocument();
  });
});
