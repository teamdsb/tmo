/* eslint-env jest */
import '@testing-library/jest-dom';
// eslint-disable-next-line import/no-commonjs
const mockReact = require('react');

process.env.TARO_ENV = 'h5';

const mockCreateComponent = (tag) => {
  return ({ children, ...props }) =>
    mockReact.createElement(tag, props, children);
};

jest.mock('@tarojs/components', () => {
  const Input = ({ onInput, onChange, ...props }) => (
    <input
      {...props}
      onChange={(event) => {
        if (onInput) {
          onInput({ detail: { value: event.target.value } });
        }
        if (onChange) {
          onChange(event);
        }
      }}
    />
  );

  return {
    View: mockCreateComponent('div'),
    Text: mockCreateComponent('span'),
    Input,
    ScrollView: mockCreateComponent('div'),
    Image: mockCreateComponent('img')
  };
});

jest.mock('lucide-react', () =>
  new Proxy(
    {},
    {
      get: () => (props) => mockReact.createElement('svg', props)
    }
  )
);

jest.mock('@taroify/icons', () =>
  new Proxy(
    {},
    {
      get: () => (props) => mockReact.createElement('svg', props)
    }
  )
);

jest.mock('@taroify/core', () => {
  const Cell = ({ title, brief, children, ...props }) => (
    <div {...props}>
      {title ? <span>{title}</span> : null}
      {brief ? <span>{brief}</span> : null}
      {children}
    </div>
  );

  const Group = ({ children, ...props }) => <div {...props}>{children}</div>;

  Cell.Group = Group;

  const Button = ({ children, ...props }) => (
    <button type='button' {...props}>
      {children}
    </button>
  );

  const Image = ({ src, width, height, ...props }) => (
    <img src={src} width={width} height={height} alt='' {...props} />
  );

  const Grid = ({ children, ...props }) => <div {...props}>{children}</div>;

  Grid.Item = ({ icon, text, ...props }) => (
    <div {...props}>
      {icon}
      {text ? <span>{text}</span> : null}
    </div>
  );

  const Tabbar = ({ children, ...props }) => <div {...props}>{children}</div>;

  Tabbar.Item = ({ children, ...props }) => <div {...props}>{children}</div>;
  Tabbar.TabItem = Tabbar.Item;

  const Badge = ({ content, children, ...props }) => (
    <span {...props}>
      {children}
      {content ? <span>{content}</span> : null}
    </span>
  );

  const Flex = ({ children, ...props }) => <div {...props}>{children}</div>;

  return {
    Cell,
    Button,
    Image,
    Grid,
    Tabbar,
    Badge,
    Flex
  };
});
