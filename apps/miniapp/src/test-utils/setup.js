/* eslint-env jest */
/* global globalThis */
import '@testing-library/jest-dom';
// eslint-disable-next-line import/no-commonjs
const mockReact = require('react');

process.env.TARO_ENV = 'h5';

const mockCreateComponent = (tag) => {
  return ({ children, ...props }) =>
    mockReact.createElement(tag, props, children);
};

const stripDomProps = (props) => {
  const {
    bordered,
    fixed,
    placeholder,
    safeArea,
    block,
    loading,
    hoverClass,
    hoverStyle,
    rightIcon,
    leftIcon,
    variant,
    color,
    size,
    shape,
    icon,
    gutter,
    align,
    justify,
    wrap,
    direction,
    inset,
    current,
    circular,
    autoplay,
    interval,
    duration,
    scrollY,
    ...rest
  } = props;
  return rest;
};

const mockComponent = (tag = 'div') => {
  return ({ children, ...props }) =>
    mockReact.createElement(tag, stripDomProps(props), children);
};

const joinClassName = (...values) => values.filter(Boolean).join(' ');

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

  const Textarea = ({ onInput, onChange, ...props }) => (
    <textarea
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

  const Button = ({ children, ...props }) => (
    <button type='button' {...stripDomProps(props)}>
      {children}
    </button>
  );

  return {
    View: mockCreateComponent('div'),
    Text: mockCreateComponent('span'),
    Button,
    Input,
    Textarea,
    ScrollView: mockComponent('div'),
    Swiper: mockComponent('div'),
    SwiperItem: mockComponent('div'),
    Image: mockCreateComponent('img')
  };
});

let mockTaroRouterParams = {};

const setTaroRouterParams = (params = {}) => {
  mockTaroRouterParams = params;
};

globalThis.__setTaroRouterParams = setTaroRouterParams;

jest.mock('@tarojs/taro', () => {
  const Taro = {
    showToast: jest.fn(() => Promise.resolve()),
    showActionSheet: jest.fn(() => Promise.resolve({ tapIndex: 0 })),
    chooseImage: jest.fn(() => Promise.resolve({ tempFilePaths: ['/tmp/mock.png'] })),
    navigateTo: jest.fn(() => Promise.resolve()),
    reLaunch: jest.fn(() => Promise.resolve()),
    switchTab: jest.fn(() => Promise.resolve()),
    getCurrentPages: jest.fn(() => []),
    getSystemInfoSync: jest.fn(() => ({
      statusBarHeight: 20,
      windowWidth: 375,
      windowHeight: 667
    })),
    getWindowInfo: jest.fn(() => ({
      statusBarHeight: 20,
      safeArea: { top: 20 }
    })),
    getAppBaseInfo: jest.fn(() => ({
      theme: 'light'
    })),
    getMenuButtonBoundingClientRect: jest.fn(() => ({
      top: 24,
      bottom: 56,
      left: 273,
      right: 360,
      height: 32,
      width: 87
    })),
    getLaunchOptionsSync: jest.fn(() => ({ query: {} }))
  };

  return {
    __esModule: true,
    default: Taro,
    useRouter: jest.fn(() => ({ params: mockTaroRouterParams })),
    useLaunch: jest.fn((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    }),
    useDidShow: jest.fn(() => {})
  };
});

jest.mock('@tmo/platform-adapter', () => {
  const storage = new Map();
  return {
    __esModule: true,
    getStorage: jest.fn(async (key) => ({ data: storage.get(key) })),
    setStorage: jest.fn(async (key, value) => {
      storage.set(key, value);
    }),
    removeStorage: jest.fn(async (key) => {
      storage.delete(key);
    })
  };
});

jest.mock('@tmo/commerce-services', () => {
  const mockProducts = [
    { id: 'prod-1001', name: 'A4 办公用纸', coverImageUrl: '', tags: ['办公'] },
    { id: 'prod-1002', name: '钢制螺栓套装', coverImageUrl: '', tags: ['工业'] },
    { id: 'prod-1003', name: '控制阀套件', coverImageUrl: '', tags: ['工业'] },
    { id: 'prod-1004', name: '封箱胶带', coverImageUrl: '', tags: ['办公'] }
  ];

  const mockOrder = {
    id: 'ORD-88291',
    createdAt: '2024-06-01T10:00:00Z',
    status: 'SHIPPED',
    items: [
      {
        qty: 1,
        unitPriceFen: 18500,
        sku: { name: '工业阀门' }
      }
    ]
  };

  const mockDetail = {
    product: {
      name: '高精度工业控制阀',
      images: []
    },
    skus: [
      {
        id: 'sku-carbon',
        name: '碳钢',
        spec: '碳钢',
        priceTiers: [{ minQty: 1, maxQty: 10, unitPriceFen: 18500 }]
      },
      {
        id: 'sku-75mm',
        name: '75mm',
        spec: '75mm',
        priceTiers: [{ minQty: 1, maxQty: 10, unitPriceFen: 20000 }]
      }
    ]
  };

  const mockCart = {
    items: [
      {
        id: 'cart-1',
        qty: 2,
        sku: { name: '示例螺栓' }
      }
    ]
  };

  return {
    __esModule: true,
    createCommerceServices: () => ({
      catalog: {
        listCategories: jest.fn(async () => ({
          items: [
            { id: 'office', name: '办公用品' },
            { id: 'industrial', name: '工业' }
          ]
        })),
        listProducts: jest.fn(async () => ({
          items: mockProducts,
          total: mockProducts.length
        })),
        getProductDetail: jest.fn(async () => mockDetail)
      },
      orders: {
        list: jest.fn(async () => ({ items: [mockOrder] })),
        get: jest.fn(async () => mockOrder),
        submit: jest.fn(async () => mockOrder)
      },
      cart: {
        getCart: jest.fn(async () => mockCart),
        getImportJob: jest.fn(async () => ({
          id: 'job-1',
          result: { pendingItems: [], autoAddedItems: [], autoAddedCount: 0, pendingCount: 0 }
        })),
        confirmImport: jest.fn(async () => mockCart),
        addItem: jest.fn(async () => ({}))
      },
      wishlist: {
        list: jest.fn(async () => []),
        add: jest.fn(async () => ({})),
        remove: jest.fn(async () => ({}))
      },
      inquiries: {
        create: jest.fn(async () => ({})),
        list: jest.fn(async () => ({ items: [] }))
      },
      afterSales: {
        listTickets: jest.fn(async () => ({ items: [] }))
      },
      productRequests: {
        list: jest.fn(async () => ({ items: [], total: 0 })),
        create: jest.fn(async () => ({})),
        uploadAsset: jest.fn(async () => ({ url: 'https://img.example.com/mock.png', contentType: 'image/png', size: 12 }))
      },
      tracking: {
        getTracking: jest.fn(async () => ({ items: [] })),
        uploadShipmentImportExcel: jest.fn(async () => ({}))
      },
      files: {
        chooseExcelFile: jest.fn(async () => ({ path: '/tmp/fake.xlsx' }))
      },
      tokens: {
        setToken: jest.fn(async () => ({}))
      }
    })
  };
});

jest.mock('@tmo/gateway-services', () => {
  return {
    __esModule: true,
    createGatewayServices: () => ({
      bootstrap: {
        get: jest.fn(async () => ({
          me: {
            displayName: '张三',
            roles: ['客户经理']
          }
        }))
      },
      tokens: {
        setToken: jest.fn(async () => ({}))
      }
    })
  };
});

jest.mock('@tmo/identity-services', () => {
  return {
    __esModule: true,
    createIdentityServices: () => ({
      tokens: {
        setToken: jest.fn(async () => ({}))
      },
      auth: {
        miniLogin: jest.fn(async () => ({}))
      },
      me: {
        get: jest.fn(async () => ({})),
        getPermissions: jest.fn(async () => ({}))
      }
    }),
    RoleSelectionRequiredError: class RoleSelectionRequiredError extends Error {
      constructor() {
        super('Role selection required');
        this.availableRoles = [];
      }
    }
  };
});

const MockNavbar = ({ children, safeArea, className, ...props }) => (
  <div
    className={className}
    data-safe-area={safeArea ?? ''}
    {...stripDomProps(props)}
  >
    {children}
  </div>
);
MockNavbar.NavLeft = ({ children, ...props }) => (
  <button type='button' {...stripDomProps(props)}>
    {children ?? '返回'}
  </button>
);
MockNavbar.Title = ({ children, ...props }) => <span {...stripDomProps(props)}>{children}</span>;
const MockTag = ({ children, ...props }) => <span {...props}>{children}</span>;
const MockFlex = mockComponent('div');
const MockFixedView = mockComponent('div');
const MockProgress = ({ percent, ...props }) => (
  <div {...stripDomProps(props)} data-percent={percent} />
);

const MockImage = ({ src, width, height, ...props }) => (
  <img src={src} width={width} height={height} alt='' {...props} />
);

const MockButton = ({ children, color, variant, className, ...props }) => {
  const extraClass = color === 'primary' ? 'bg-[#137fec] border-[#137fec]' : '';
  return (
    <button
      type='button'
      className={joinClassName(className, extraClass)}
      {...stripDomProps(props)}
    >
      {children}
    </button>
  );
};

const MockCell = ({ title, brief, children, ...props }) => (
  <div {...stripDomProps(props)}>
    {title ? <span>{title}</span> : null}
    {brief ? <span>{brief}</span> : null}
    {children}
  </div>
);

MockCell.Group = ({ children, ...props }) => <div {...stripDomProps(props)}>{children}</div>;

const MockGrid = ({ children, ...props }) => <div {...stripDomProps(props)}>{children}</div>;
MockGrid.Item = ({ icon, text, children, ...props }) => (
  <div {...stripDomProps(props)}>
    {icon}
    {text ? <span>{text}</span> : null}
    {children}
  </div>
);

const MockTabs = ({ children, value, onChange, sticky }) => (
  <div
    data-sticky-offset-top={
      sticky && typeof sticky === 'object' && 'offsetTop' in sticky
        ? String(sticky.offsetTop)
        : ''
    }
  >
    {mockReact.Children.map(children, (child) => {
      if (!mockReact.isValidElement(child)) return child;
      const isActive = String(child.props.value) === String(value);
      return (
        <div>
          <button
            type='button'
            className={isActive ? 'text-[#137fec]' : ''}
            onClick={() => onChange?.(child.props.value)}
          >
            {child.props.title ?? child.props.value}
          </button>
          {isActive ? child.props.children : null}
        </div>
      );
    })}
  </div>
);

MockTabs.TabPane = ({ children }) => <div>{children}</div>;

const MockTabbar = ({ children, value, onChange, ...props }) => (
  <div {...stripDomProps(props)}>
    {mockReact.Children.map(children, (child) => {
      if (!mockReact.isValidElement(child)) return child;
      const handleClick = () => onChange?.(child.props.value);
      return mockReact.cloneElement(child, {
        onClick: handleClick,
        className: child.props.value === value ? 'text-[#137fec]' : child.props.className
      });
    })}
  </div>
);

MockTabbar.TabItem = ({ icon, children, ...props }) => (
  <button type='button' {...props}>
    {icon}
    {children}
  </button>
);

const MockSearch = ({ value, placeholder, onChange, clearable, ...props }) => (
  <div>
    <input
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(event) => onChange?.({ detail: { value: event.target.value } })}
      {...stripDomProps(props)}
    />
    {clearable ? (
      <button type='button' onClick={() => onChange?.({ detail: { value: '' } })}>
        close
      </button>
    ) : null}
  </div>
);

const MockEmpty = ({ children, ...props }) => <div {...stripDomProps(props)}>{children}</div>;
MockEmpty.Image = ({ src, ...props }) => <img src={src} alt='' {...props} />;
MockEmpty.Description = ({ children, ...props }) => <div {...props}>{children}</div>;

jest.mock('@taroify/core/navbar', () => ({ __esModule: true, default: MockNavbar }));
jest.mock('@taroify/core/tag', () => ({ __esModule: true, default: MockTag }));
jest.mock('@taroify/core/flex', () => ({ __esModule: true, default: MockFlex }));
jest.mock('@taroify/core/fixed-view', () => ({ __esModule: true, default: MockFixedView }));
jest.mock('@taroify/core/progress', () => ({ __esModule: true, default: MockProgress }));
jest.mock('@taroify/core/image', () => ({ __esModule: true, default: MockImage }));
jest.mock('@taroify/core/button', () => ({ __esModule: true, default: MockButton }));
jest.mock('@taroify/core/cell', () => ({ __esModule: true, default: MockCell }));
jest.mock('@taroify/core/grid', () => ({ __esModule: true, default: MockGrid }));
jest.mock('@taroify/core/tabs', () => ({ __esModule: true, default: MockTabs }));
jest.mock('@taroify/core/tabbar', () => ({ __esModule: true, default: MockTabbar }));
jest.mock('@taroify/core/search', () => ({ __esModule: true, default: MockSearch }));
jest.mock('@taroify/core/empty', () => ({ __esModule: true, default: MockEmpty }));

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
