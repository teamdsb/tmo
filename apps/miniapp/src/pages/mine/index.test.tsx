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

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Role: Account Manager')).toBeInTheDocument();
    expect(screen.getByText('Account Manager')).toBeInTheDocument();
  });

  it('renders the logout button', async () => {
    await renderPersonalCenter();

    const button = screen.getByText('Switch Account or Logout');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByText('Switch Account or Logout')).toBeInTheDocument();
  });

  it('renders the tabbar items', async () => {
    await renderPersonalCenter();

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Mine')).toBeInTheDocument();
  });
});
