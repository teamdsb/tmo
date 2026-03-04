import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle,
  ChevronUp,
  Clock,
  Filter,
  Headphones,
  Image as ImageIcon,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Send,
  ShoppingCart,
  Smile,
  Star,
  Truck,
  Wand2
} from 'lucide-react';
import { AdminTopbar } from '../../layout/AdminTopbar';

type OrderStatusColor = 'blue' | 'green' | 'amber';
type ChatStatus = '咨询中' | '售后' | '新会话';
type FilterType = '全部' | '未读' | '优先';

type ChatMessage = {
  id: number;
  type: 'date' | 'customer' | 'agent';
  content: string;
  time?: string;
  image?: string;
};

type CustomerOrder = {
  id: string;
  amount: string;
  date: string;
  status: string;
  statusColor: OrderStatusColor;
};

type CustomerInquiry = {
  id: string;
  title: string;
  desc: string;
  icon: typeof Headphones;
  color: 'amber' | 'blue';
};

type ChatThread = {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: ChatStatus;
  email: string;
  level: string;
  attribution: string;
  orders: CustomerOrder[];
  inquiries: CustomerInquiry[];
  messages: ChatMessage[];
};

const INITIAL_CHATS: ChatThread[] = [
  {
    id: 1,
    name: 'Alex Johnson',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop',
    lastMessage: '我最近的订单有点问题，想咨询一下。',
    time: '2 分钟前',
    unread: 3,
    status: '咨询中',
    email: 'alex.j@example.com',
    level: '铂金',
    attribution: '自然搜索',
    orders: [
      { id: 'ORD-12345', amount: '$249.00', date: '2024年5月12日', status: '已发货', statusColor: 'blue' },
      { id: 'ORD-11982', amount: '$89.50', date: '2024年4月28日', status: '已送达', statusColor: 'green' },
      { id: 'ORD-11540', amount: '$1,120.00', date: '2024年3月15日', status: '已送达', statusColor: 'green' }
    ],
    inquiries: [
      { id: 'TK-8812', title: '退换货申请', desc: '已分配至退货组', icon: Headphones, color: 'amber' },
      { id: 'TK-9021', title: '物流追踪更新', desc: '客户请求更换承运商', icon: Truck, color: 'blue' }
    ],
    messages: [
      { id: 1, type: 'date', content: '今天 10:45' },
      {
        id: 2,
        type: 'customer',
        content: '你好，我昨天收到了订单 #12345，但其中一件尺码不对。请问如何申请换货？',
        time: '10:46'
      },
      {
        id: 3,
        type: 'agent',
        content: '您好 Alex，很抱歉给您带来不便。我来协助您处理换货。麻烦上传商品和标签照片，我先帮您核验。',
        time: '10:48'
      },
      {
        id: 4,
        type: 'customer',
        content: '好的，我上传了图片：',
        time: '10:52',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=400&fit=crop'
      }
    ]
  },
  {
    id: 2,
    name: 'Maria Garcia',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    lastMessage: '感谢你的更新！',
    time: '14 分钟前',
    unread: 0,
    status: '售后',
    email: 'm.garcia@provider.com',
    level: '黄金',
    attribution: '谷歌广告',
    orders: [{ id: 'ORD-1002', amount: '$45.00', date: '2024年5月10日', status: '处理中', statusColor: 'amber' }],
    inquiries: [],
    messages: [
      { id: 1, type: 'customer', content: '请问我的退款处理了吗？', time: '09:00' },
      { id: 2, type: 'agent', content: '已经处理完成，通常会在 3-5 个工作日到账。', time: '09:05' }
    ]
  },
  {
    id: 3,
    name: 'Kevin Smith',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    lastMessage: '这个商品什么时候补货？',
    time: '1 小时前',
    unread: 0,
    status: '新会话',
    email: 'kev.smith@domain.io',
    level: '白银',
    attribution: '社交媒体',
    orders: [],
    inquiries: [],
    messages: [{ id: 1, type: 'customer', content: '你好，皮夹克什么时候能补货？', time: '昨天' }]
  }
];

const SidebarItem = ({
  chat,
  active,
  onClick
}: {
  chat: ChatThread;
  active: boolean;
  onClick: (chat: ChatThread) => void;
}) => (
  <button
    type="button"
    onClick={() => onClick(chat)}
    className={`flex w-full items-start gap-3 p-4 text-left cursor-pointer transition-all border-b border-slate-100 dark:border-slate-800 ${
      active ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
    }`}
  >
    <div className="relative shrink-0">
      <img className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" src={chat.avatar} alt={chat.name} />
      {active ? <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-green-500"></span> : null}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-0.5">
        <span className={`font-semibold text-sm truncate ${active ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200'}`}>
          {chat.name}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">{chat.time}</span>
      </div>
      <p className={`text-xs truncate ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>{chat.lastMessage}</p>
      <div className="flex gap-2 mt-2">
        <span
          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            chat.status === '咨询中' ? 'bg-amber-100 text-amber-700' : chat.status === '售后' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {chat.status}
        </span>
      </div>
    </div>
    {!active && chat.unread > 0 ? (
      <span className="h-4 w-4 flex items-center justify-center bg-indigo-600 text-white text-[10px] rounded-full shrink-0">{chat.unread}</span>
    ) : null}
  </button>
);

const Message = ({ msg, customerAvatar, agentNameInitial }: { msg: ChatMessage; customerAvatar: string; agentNameInitial: string }) => {
  if (msg.type === 'date') {
    return (
      <div className="flex justify-center my-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{msg.content}</span>
      </div>
    );
  }

  const isCustomer = msg.type === 'customer';

  return (
    <div className={`flex items-start gap-3 max-w-2xl ${!isCustomer ? 'ml-auto flex-row-reverse' : ''}`}>
      {isCustomer ? (
        <img className="h-8 w-8 rounded-full shrink-0 border border-slate-200 dark:border-slate-700" src={customerAvatar} alt="客户头像" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">{agentNameInitial}</div>
      )}
      <div className={`space-y-1 ${!isCustomer ? 'flex flex-col items-end' : ''}`}>
        <div
          className={`p-4 rounded-2xl shadow-sm border ${
            isCustomer ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-tl-none' : 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none'
          }`}
        >
          {msg.content ? <p className="text-sm leading-relaxed">{msg.content}</p> : null}
          {msg.image ? (
            <div className={`mt-3 rounded-lg overflow-hidden border ${isCustomer ? 'border-slate-200 dark:border-slate-600' : 'border-indigo-400'}`}>
              <img className="w-full object-cover max-h-60" src={msg.image} alt="客户上传图片" />
            </div>
          ) : null}
        </div>
        <div className={`flex items-center gap-1 text-[10px] text-slate-400 ${isCustomer ? 'ml-1' : 'mr-1'}`}>
          <span>{msg.time}</span>
          {!isCustomer ? <CheckCircle className="w-3 h-3 text-indigo-400" /> : null}
        </div>
      </div>
    </div>
  );
};

const statusClassByOrderColor: Record<OrderStatusColor, string> = {
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700'
};

const formatCurrentTime = () => {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const SupportWorkspacePage = () => {
  const [chats, setChats] = useState<ChatThread[]>(INITIAL_CHATS);
  const [activeChatId, setActiveChatId] = useState(1);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState<FilterType>('全部');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeChat = useMemo(() => {
    return chats.find((chat) => chat.id === activeChatId) || chats[0];
  }, [activeChatId, chats]);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      if (filter === '未读') return chat.unread > 0;
      if (filter === '优先') return chat.status === '咨询中';
      return true;
    });
  }, [chats, filter]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length]);

  const handleSendMessage = useCallback(
    (event?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      const messageText = inputText.trim();
      if (!messageText) return;

      const newMessage: ChatMessage = {
        id: Date.now(),
        type: 'agent',
        content: messageText,
        time: formatCurrentTime()
      };

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== activeChatId) {
            return chat;
          }
          return {
            ...chat,
            messages: [...chat.messages, newMessage],
            lastMessage: messageText,
            time: '刚刚'
          };
        })
      );
      setInputText('');
    },
    [activeChatId, inputText]
  );

  const handleSelectChat = useCallback((chat: ChatThread) => {
    setActiveChatId(chat.id);
    if (chat.unread > 0) {
      setChats((prevChats) =>
        prevChats.map((item) => {
          if (item.id !== chat.id) {
            return item;
          }
          return {
            ...item,
            unread: 0
          };
        })
      );
    }
  }, []);

  if (!activeChat) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
        <p className="text-sm font-medium">暂无会话数据</p>
      </div>
    );
  }

  const primaryOrderId = activeChat.orders[0]?.id ?? '暂无订单';
  const displayName = activeChat.name.split(/\s+/).filter(Boolean)[0] || activeChat.name;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <AdminTopbar
        searchPlaceholder="搜索订单、工单..."
        leftSlot={
          <>
            <div className="flex items-center gap-2 text-indigo-600">
              <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                <Activity size={20} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">客服中枢</h1>
            </div>
            <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold">
              <a className="text-indigo-600 border-b-2 border-indigo-600 py-5 transition-all" href="#">
                工作台
              </a>
              <a className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100" href="#">
                客户
              </a>
              <a className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100" href="#">
                订单
              </a>
              <a className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100" href="#">
                分析
              </a>
            </nav>
          </>
        }
      />

      <main className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="hidden lg:flex w-80 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-600" />
                进行中会话
              </h2>
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{chats.length} 个工单</span>
            </div>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
              {(['全部', '未读', '优先'] as FilterType[]).map((currentFilter) => (
                <button
                  key={currentFilter}
                  type="button"
                  onClick={() => setFilter(currentFilter)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    filter === currentFilter ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {currentFilter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length > 0 ? (
              filteredChats.map((chat) => <SidebarItem key={chat.id} chat={chat} active={activeChatId === chat.id} onClick={handleSelectChat} />)
            ) : (
              <div className="px-4 py-10 text-center text-xs text-slate-400">当前筛选条件下没有会话</div>
            )}
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 transition-all"
            >
              <Filter size={14} />
              查看全部已关闭
            </button>
          </div>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col bg-slate-50 dark:bg-slate-950">
          <div className="h-16 flex items-center justify-between px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <div className="font-bold text-slate-800 dark:text-white">
                {activeChat.name}
                <span className="text-xs font-medium text-slate-400 ml-2">#{primaryOrderId}</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <MoreHorizontal size={14} />
                转交
              </button>
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
              >
                <ShoppingCart size={14} />
                创建订单
              </button>
              <button type="button" className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all">
                <CheckCircle size={14} />
                完成工单
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeChat.messages.map((msg) => (
              <Message key={msg.id} msg={msg} customerAvatar={activeChat.avatar} agentNameInitial="JS" />
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800" onSubmit={handleSendMessage}>
            <div className="relative bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <div className="flex gap-1 mb-2">
                <button type="button" className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all">
                  <span className="font-bold text-sm">B</span>
                </button>
                <button type="button" className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-all">
                  <span className="italic text-sm">I</span>
                </button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1 self-center"></div>
                <button
                  type="button"
                  onClick={() => setInputText(`您好 ${displayName}，我正在为您核实处理，请稍候。`)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-100 transition-all"
                >
                  <Wand2 size={12} />
                  快速回复
                </button>
              </div>
              <textarea
                className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-slate-400 resize-none"
                placeholder={`给 ${activeChat.name} 发送消息...`}
                rows={3}
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSendMessage();
                  }
                }}
              ></textarea>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1">
                  <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white dark:hover:bg-slate-700">
                    <Paperclip size={18} />
                  </button>
                  <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white dark:hover:bg-slate-700">
                    <Smile size={18} />
                  </button>
                  <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white dark:hover:bg-slate-700">
                    <ImageIcon size={18} />
                  </button>
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  disabled={!inputText.trim()}
                >
                  发送
                  <Send size={16} />
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="hidden xl:flex w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col shrink-0 overflow-y-auto">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">客户档案</h3>
              <button type="button" className="text-slate-300 hover:text-slate-600">
                <MoreVertical size={16} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <img className="h-24 w-24 rounded-3xl object-cover shadow-2xl ring-4 ring-slate-50 dark:ring-slate-800" src={activeChat.avatar} alt="客户头像" />
                <span className="absolute -bottom-2 -right-2 p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                </span>
              </div>
              <h4 className="font-black text-lg text-slate-800 dark:text-white leading-tight">{activeChat.name}</h4>
              <p className="text-xs font-medium text-slate-500 mb-6">{activeChat.email}</p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 text-left">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">会员等级</span>
                  <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{activeChat.level}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 text-left">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">来源渠道</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{activeChat.attribution}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">最近订单</h3>
              <ChevronUp size={16} className="text-slate-300" />
            </div>
            <div className="space-y-3">
              {activeChat.orders.length > 0 ? (
                activeChat.orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black group-hover:text-indigo-600 transition-colors">{order.id}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{order.amount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {order.date}
                      </span>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusClassByOrderColor[order.statusColor]}`}>{order.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-xs text-slate-400 font-medium italic">暂无最近订单</div>
              )}
            </div>
            {activeChat.orders.length > 0 ? (
              <button type="button" className="w-full mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 py-3 border-2 border-dashed border-indigo-100 dark:border-indigo-900/50 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                查看完整历史
              </button>
            ) : null}
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">当前工单</h3>
              <ChevronUp size={16} className="text-slate-300" />
            </div>
            <div className="space-y-4">
              {activeChat.inquiries.length > 0 ? (
                activeChat.inquiries.map((inquiry) => {
                  const Icon = inquiry.icon;
                  return (
                    <div key={inquiry.id} className="flex gap-4 group cursor-pointer">
                      <div
                        className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                          inquiry.color === 'amber' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black group-hover:text-indigo-600">{inquiry.title}</h5>
                        <p className="text-[10px] font-bold text-slate-400 leading-tight">
                          #{inquiry.id} • {inquiry.desc}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-slate-400 font-medium italic">暂无其他进行中工单</div>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};
