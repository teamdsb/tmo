import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import OrderHistoryApp from './index';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

const renderOrderHistory = async () => {
  render(<OrderHistoryApp />);
  await act(async () => {
    await flushPromises();
  });
};

describe('OrderHistoryApp', () => {
  it('renders tabs and order cards', async () => {
    await renderOrderHistory();

    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getByText('待处理')).toBeInTheDocument();
    expect(screen.queryByText('ORD-88291')).not.toBeInTheDocument();
    const orderDate = document.querySelector('.order-date');
    expect(orderDate).toBeInTheDocument();
    expect(orderDate).toHaveClass('order-date');
  });

  it('switches active tab', async () => {
    await renderOrderHistory();

    const shippedTab = screen
      .getAllByText('已发货')
      .find((node) => node.closest('button'));
    const shippedButton = shippedTab ? shippedTab.closest('button') : null;

    expect(shippedButton).not.toBeNull();
    if (!shippedButton) {
      throw new Error('Expected shipped tab button');
    }
    fireEvent.click(shippedButton);

    expect(shippedButton).toHaveClass('text-[#137fec]');
  });

  it('uses shared secondary navbar sizing and compact order list spacing', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../../app.scss'), 'utf8');

    expect(stylesheet).toContain('.app-navbar--secondary .taroify-navbar__content {');
    expect(stylesheet).not.toContain('.order-history-page .app-navbar .taroify-navbar__content');
    expect(stylesheet).toContain('.order-history-body {');
    expect(stylesheet).toContain('padding: 18rpx 24rpx calc(126rpx + var(--tabbar-safe-offset));');
    expect(stylesheet).toContain('.order-history-tabs .taroify-tabs__wrap {');
    expect(stylesheet).toContain('min-height: 84rpx;');
  });
});
