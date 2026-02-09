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

    const navbar = document.querySelector('.app-navbar.app-navbar--primary');
    expect(navbar).not.toBeNull();

    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText('王经理')).toBeInTheDocument();
    expect(screen.queryByText('客户经理')).not.toBeInTheDocument();
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

    expect(screen.getByText('订单跟踪')).toBeInTheDocument();
    expect(screen.getByText('我的需求')).toBeInTheDocument();
    expect(screen.getByText('收藏')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });
});
