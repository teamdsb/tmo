import { act, fireEvent, render, screen } from '@testing-library/react';
import PersonalCenter from './index';

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve));

const renderPersonalCenter = async () => {
  render(<PersonalCenter />);
  await act(async () => {
    await flushPromises();
  });
};

describe('PersonalCenter', () => {
  it('renders user info and key sections', async () => {
    await renderPersonalCenter();

    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText('客户经理')).toBeInTheDocument();
    expect(screen.getByText('王经理')).toBeInTheDocument();
  });

  it('renders the logout button', async () => {
    await renderPersonalCenter();

    const button = screen.getByText('切换账号或退出登录');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByText('切换账号或退出登录')).toBeInTheDocument();
  });

  it('renders key menu entries', async () => {
    await renderPersonalCenter();

    expect(screen.getByRole('button', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分类' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '购物车' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的' })).toBeInTheDocument();

    const tabbarRoot = screen.getByRole('button', { name: '首页' }).parentElement;
    expect(tabbarRoot).not.toBeNull();
    if (!tabbarRoot) {
      throw new Error('Expected tabbar root');
    }
    expect(tabbarRoot).toHaveClass('app-tabbar');
    expect(tabbarRoot).toHaveClass('app-tabbar--fixed');
  });
});
