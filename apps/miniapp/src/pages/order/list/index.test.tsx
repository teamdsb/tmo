import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Taro from '@tarojs/taro';
import { commerceServices } from '../../../services/commerce';
import { paymentServices } from '../../../services/payment';
import OrderHistoryApp from './index';

jest.mock('../../../services/payment', () => ({
  paymentServices: {
    sessions: {
      payForOrder: jest.fn()
    }
  },
  isPaymentCancelled: jest.fn(() => false)
}));

jest.mock('../../../services/payment-availability', () => ({
  buildOrderPaymentIdempotencyKey: jest.fn((orderId: string) => `order-payment-${orderId}`),
  resolvePaymentAvailability: jest.fn(async () => ({
    available: true,
    channel: 'wechat',
    unavailableMessage: ''
  }))
}));

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

const renderOrderHistory = async () => {
  render(<OrderHistoryApp />);
  await act(async () => {
    await flushPromises();
  });
};

describe('OrderHistoryApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('confirms receipt for shipped orders and refreshes the list', async () => {
    await renderOrderHistory();

    await act(async () => {
      fireEvent.click(screen.getByText('确认收货'));
      await flushPromises();
    });

    expect(Taro.showModal).toHaveBeenCalledWith({
      title: '确认收货',
      content: '确认已收到该订单商品？'
    });
    expect(commerceServices.orders.confirmReceipt).toHaveBeenCalledWith('ORD-88291');
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '已确认收货', icon: 'success' });
    expect(commerceServices.orders.list).toHaveBeenCalledTimes(2);
  });

  it('shows a direct pay entry for unpaid orders and starts payment', async () => {
    (commerceServices.orders.list as jest.Mock).mockResolvedValue({
      items: [{
        id: 'ORD-PAY-1',
        createdAt: '2026-07-15T07:55:27Z',
        status: 'PAY_PENDING',
        paymentStatus: 'PAY_PENDING',
        items: [{
          qty: 1,
          unitPriceFen: 1,
          sku: { name: '反光安全背心' }
        }]
      }]
    });
    (paymentServices.sessions.payForOrder as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      orderId: 'ORD-PAY-1',
      channel: 'wechat',
      status: 'PAID'
    });

    await renderOrderHistory();

    expect(screen.getByText('待支付')).toBeInTheDocument();
    expect(screen.getByText('去支付')).toBeInTheDocument();
    expect(screen.queryByText('物流')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('去支付'));
      await flushPromises();
    });

    expect(paymentServices.sessions.payForOrder).toHaveBeenCalledWith('ORD-PAY-1', {
      channel: 'wechat',
      idempotencyKey: 'order-payment-ORD-PAY-1'
    });
    expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '支付成功',
      icon: 'success'
    }));
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/order/success/index?id=ORD-PAY-1&payment=paid'
    });
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
