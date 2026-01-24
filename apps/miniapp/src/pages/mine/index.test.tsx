import { fireEvent, render, screen } from '@testing-library/react';
import PersonalCenter from './index';

describe('PersonalCenter', () => {
  it('renders user info and key sections', () => {
    render(<PersonalCenter />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('TechFlow Solutions Corp')).toBeInTheDocument();
    expect(screen.getByText('Account Manager')).toBeInTheDocument();
  });

  it('renders the logout button', () => {
    render(<PersonalCenter />);

    const button = screen.getByText('Switch Account or Logout');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByText('Switch Account or Logout')).toBeInTheDocument();
  });

  it('renders the tabbar items', () => {
    render(<PersonalCenter />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Demand')).toBeInTheDocument();
    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Mine')).toBeInTheDocument();
  });
});
