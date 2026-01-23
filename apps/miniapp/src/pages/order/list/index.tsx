import { useState } from 'react';
import { 
  ChevronLeft, 
  Filter, 
  Search, 
  Home, 
  Compass, 
  ShoppingCart, 
  ScrollText, 
  User 
} from 'lucide-react';

// Mock Data derived from the HTML
const ORDERS = [
  {
    id: 'ORD-88291',
    date: 'Oct 24, 2023 · 14:30',
    status: 'Shipped',
    statusColor: 'bg-blue-100 text-[#137fec] dark:bg-blue-900/30 dark:text-[#137fec]',
    title: 'Industrial Grade Steel Bolt X10...',
    totalUnits: '152 Units',
    priceLabel: 'Total Price',
    price: '$1,240.50',
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBPtFkTTnJz7-tK01nu6XyhNmTYWdeeXHFCkor4f-GBb6Mg-42dp6wsTE2K0LOzAs5iMYxmPhEy5DrqPZCNjyOnZmmh4k-tJHYr7mcXK-SyP6UFBk92X4RfLSkdLl4ZYq9f4t0wUHGTSeGpz8mZN6BBkOEvi3qseq7RGZIVrO8n4aZi3WzcugE2huj0TAGp9sPAdbHNfsLs2dgrM-RGjXB12X5RBBSDiMC12wuyApAEXCfP8ixHiQYdbIsSjkm_C_CAsrRORhPY-vzY",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAnPMvTeyxKpURIclK4WcQBEoztQwcgoIduvJ7elXci4t-b4jmiGH5hINqwNYaVQTsXOmmpmQPJmsVi_q-YOSprnoo5leUAX_nKjw_DKUebMVfcWtLHWDt6qjy7jTJuwl19bipAfw2yGdQExhabRQJJJdViJs2DJY8WTUSxOw7kXlmSBGUKH98nXZpnjmhvF5TWEeOI_t6LkZ-FmvS3rMzptmy8f0S4H0nynw1QUaMPCFHHXpucRlWV5xevXTvYKnm2PM2qWJS297Fi"
    ],
    moreImagesCount: 1,
    actions: [
      { label: 'Details', primary: false },
      { label: 'Track', primary: true }
    ]
  },
  {
    id: 'ORD-88285',
    date: 'Oct 23, 2023 · 09:15',
    status: 'Pending Intent',
    statusColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    title: 'Ergonomic Office Chair Pro',
    totalUnits: '5 Units',
    priceLabel: 'Est. Total',
    price: '$675.00',
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDe7m1RTxL4-VlzD8EF8swLSee4fT57qak-mM014a0GStp2i7S5NuxLAXIR1qAshFpCJkY_-olfmgn5uqRNPN3AcbADyS0WGM2Y4wiJ6ZghxFoM-g7S-WJJUVGBoAaDUJU2alarMOlRXqX-kwDDZW6PrcSesHu1l1PMb6HG6H2vO77ahxmtngETasDsGbgWPaGybJr5q7_IMCQUHC46kts-wHVc-rhvyW8K2E9SFReV38XXYjmcYfcd7HkkBzsGnchKBzw8O_X7o17q"
    ],
    moreImagesCount: 0,
    actions: [
      { label: 'View Quote', primary: false }
    ]
  },
  {
    id: 'ORD-88102',
    date: 'Oct 15, 2023 · 16:45',
    status: 'Completed',
    statusColor: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    title: 'Heavy Duty Shipping Box L',
    totalUnits: '500 Units',
    priceLabel: 'Final Price',
    price: '$850.00',
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDGj0LySxxnfLRBsNvxC-nPykQ5urTBjIfVH6fpVr8Mq6q86Eoc900uHrsM4CWGhiTa9mh1Hjt_59YVZA8IA8o2egRuHhPMh4OOTNdFLPyy2z65oun7A7T75qdtMxB9Gx2g6hdqG7a6CoFl7wbFQ5OqSxcViSThFyQsbrrOF2K3eSm2S5yLloAGrV9xlvJmEFK-mPaQa76VxZBF-w06tpKTQ_Ecu_J9NqQcflv5Lxn_pdg9JpuXZou5PV-r29n5aUgmxkh1RVsTN382"
    ],
    moreImagesCount: 0,
    actions: [
      { label: 'Reorder', primary: false, customStyle: 'text-[#137fec] border border-[#137fec]/20 bg-[#137fec]/5' }
    ]
  }
];

const TABS = ['All', 'Pending Intent', 'Confirmed', 'Shipped', 'Completed'];

export default function OrderHistoryApp() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className='font-sans bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white min-h-screen flex flex-col'>
      {/* Header Section */}
      <header className='sticky top-0 z-50 bg-white dark:bg-[#101922] border-b border-gray-200 dark:border-gray-800'>
        <div className='flex items-center px-4 pt-10 pb-2 justify-between'>
          <button className='text-[#111418] dark:text-white flex size-10 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors'>
            <ChevronLeft size={24} />
          </button>
          <h1 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center'>
            Order History
          </h1>
          <button className='text-[#111418] dark:text-white flex size-10 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors'>
            <Filter size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className='px-4 py-3 bg-white dark:bg-[#101922]'>
          <div className='flex flex-col min-w-40 h-10 w-full'>
            <div className='flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden'>
              <div className='text-[#617589] dark:text-gray-400 flex border-none bg-[#f0f2f4] dark:bg-gray-800 items-center justify-center pl-4 rounded-l-lg'>
                <Search size={20} />
              </div>
              <input 
                className='flex w-full min-w-0 flex-1 border-none bg-[#f0f2f4] dark:bg-gray-800 text-[#111418] dark:text-white focus:ring-0 placeholder:text-[#617589] px-4 rounded-r-lg pl-2 text-sm font-normal outline-none'
                placeholder='Search by Order ID or Product...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabs (Horizontal Scroll) */}
        <div className='overflow-x-auto no-scrollbar bg-white dark:bg-[#101922]'>
          <div className='flex border-b border-gray-100 dark:border-gray-800 px-4 gap-6 min-w-max'>
            {TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 transition-colors ${
                    isActive
                      ? 'border-[#137fec] text-[#137fec]'
                      : 'border-transparent text-[#617589] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white'
                  }`}
                >
                  <p className={`text-sm tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {tab}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1 overflow-y-auto'>
        <div className='p-4 flex flex-col gap-4 pb-28'>
          {ORDERS.map((order) => (
            <OrderCard key={order.id} data={order} />
          ))}
          
          {/* Spacer for bottom nav */}
          <div className='h-4'></div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className='fixed bottom-0 w-full bg-white dark:bg-[#101922] border-t border-gray-200 dark:border-gray-800 pb-8 pt-3 px-2 flex justify-around items-center z-50'>
        <NavButton icon={Home} label='Home' />
        <NavButton icon={Compass} label='Demand' />
        <NavButton icon={ShoppingCart} label='Cart' />
        <NavButton icon={ScrollText} label='Orders' active />
        <NavButton icon={User} label='Mine' />
      </nav>
    </div>
  );
}

// Sub-components for better organization

function OrderCard({ data }) {
  return (
    <div className='bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col p-4'>
      {/* Header: ID + Status */}
      <div className='flex justify-between items-start mb-3'>
        <div>
          <p className='text-xs text-[#617589] dark:text-gray-400 font-medium'>Order #{data.id}</p>
          <p className='text-[11px] text-[#617589] dark:text-gray-400'>{data.date}</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${data.statusColor}`}>
          {data.status}
        </span>
      </div>

      {/* Body: Images + Info */}
      <div className='flex items-center gap-3 mb-4'>
        {/* Images Container */}
        <div className={`flex ${data.images.length > 1 ? '-space-x-3' : ''} overflow-hidden`}>
          {data.images.map((img, idx) => (
            <div 
              key={idx} 
              className='inline-block h-12 w-12 rounded-lg ring-2 ring-white dark:ring-gray-900 bg-[#f0f2f4] dark:bg-gray-800 overflow-hidden'
            >
              <img src={img} alt='Product' className='w-full h-full object-cover' />
            </div>
          ))}
          
          {/* +1 Overlay if needed */}
          {data.moreImagesCount > 0 && (
            <div className='flex items-center justify-center h-12 w-12 rounded-lg ring-2 ring-white dark:ring-gray-900 bg-gray-100 dark:bg-gray-800 text-[10px] font-bold text-gray-500'>
              +{data.moreImagesCount}
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className='flex-1 min-w-0'>
          <p className='text-xs text-[#111418] dark:text-white font-medium truncate'>
            {data.title}
          </p>
          <p className='text-[11px] text-[#617589] dark:text-gray-400'>
            Total: {data.totalUnits}
          </p>
        </div>
      </div>

      {/* Footer: Price + Actions */}
      <div className='flex items-center justify-between border-t border-gray-50 dark:border-gray-800 pt-3 mt-1'>
        <div>
          <p className='text-[10px] text-[#617589] dark:text-gray-400 uppercase font-semibold'>
            {data.priceLabel}
          </p>
          <p className='text-base font-bold text-[#111418] dark:text-white'>
            {data.price}
          </p>
        </div>
        <div className='flex gap-2'>
          {data.actions.map((action, idx) => {
            // Determine button styles
            let btnClass = "px-4 py-2 text-xs font-semibold rounded-lg active:scale-95 transition-transform ";
            if (action.customStyle) {
              btnClass += action.customStyle;
            } else if (action.primary) {
              btnClass += "text-white bg-[#137fec] shadow-lg shadow-[#137fec]/20";
            } else {
              btnClass += "text-[#111418] dark:text-white bg-gray-100 dark:bg-gray-800";
            }

            return (
              <button key={idx} className={btnClass}>
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active = false }) {
  return (
    <button className={`flex flex-col items-center gap-1 flex-1 ${active ? 'text-[#137fec]' : 'text-[#617589] dark:text-gray-400'}`}>
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>
        {label}
      </span>
    </button>
  );
}
