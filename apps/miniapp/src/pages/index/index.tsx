import { useState } from 'react';
import { 
  Menu, 
  Bell, 
  Search, 
  Filter, 
  LayoutGrid, 
  ShoppingCart, 
  Plus, 
  Home, 
  FileText, 
  ScrollText, 
  User 
} from 'lucide-react';

// Mock Data derived from the HTML
const PRODUCTS = [
  {
    id: 1,
    sku: 'BOLT-X10',
    title: 'Industrial Grade Steel Bolt X10',
    price: '$2.50 - $4.00',
    minUnits: 'Min: 50 units',
    tag: 'Bulk Ready',
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBPtFkTTnJz7-tK01nu6XyhNmTYWdeeXHFCkor4f-GBb6Mg-42dp6wsTE2K0LOzAs5iMYxmPhEy5DrqPZCNjyOnZmmh4k-tJHYr7mcXK-SyP6UFBk92X4RfLSkdLl4ZYq9f4t0wUHGTSeGpz8mZN6BBkOEvi3qseq7RGZIVrO8n4aZi3WzcugE2huj0TAGp9sPAdbHNfsLs2dgrM-RGjXB12X5RBBSDiMC12wuyApAEXCfP8ixHiQYdbIsSjkm_C_CAsrRORhPY-vzY"
  },
  {
    id: 2,
    sku: 'CHR-PRO',
    title: 'Ergonomic Office Chair Pro',
    price: '$120.00 - $150.00',
    minUnits: 'Min: 5 units',
    tag: 'Stock Low',
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDe7m1RTxL4-VlzD8EF8swLSee4fT57qak-mM014a0GStp2i7S5NuxLAXIR1qAshFpCJkY_-olfmgn5uqRNPN3AcbADyS0WGM2Y4wiJ6ZghxFoM-g7S-WJJUVGBoAaDUJU2alarMOlRXqX-kwDDZW6PrcSesHu1l1PMb6HG6H2vO77ahxmtngETasDsGbgWPaGybJr5q7_IMCQUHC46kts-wHVc-rhvyW8K2E9SFReV38XXYjmcYfcd7HkkBzsGnchKBzw8O_X7o17q"
  },
  {
    id: 3,
    sku: 'CBL-E100',
    title: 'High-Speed Ethernet Cable 100m',
    price: '$5.00 - $8.00',
    minUnits: 'Min: 100 units',
    tag: 'Fast Ship',
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnPMvTeyxKpURIclK4WcQBEoztQwcgoIduvJ7elXci4t-b4jmiGH5hINqwNYaVQTsXOmmpmQPJmsVi_q-YOSprnoo5leUAX_nKjw_DKUebMVfcWtLHWDt6qjy7jTJuwl19bipAfw2yGdQExhabRQJJJdViJs2DJY8WTUSxOw7kXlmSBGUKH98nXZpnjmhvF5TWEeOI_t6LkZ-FmvS3rMzptmy8f0S4H0nynw1QUaMPCFHHXpucRlWV5xevXTvYKnm2PM2qWJS297Fi"
  },
  {
    id: 4,
    sku: 'BOX-HD',
    title: 'Heavy Duty Shipping Box L',
    price: '$1.20 - $2.00',
    minUnits: 'Min: 200 units',
    tag: 'Recyclable',
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDGj0LySxxnfLRBsNvxC-nPykQ5urTBjIfVH6fpVr8Mq6q86Eoc900uHrsM4CWGhiTa9mh1Hjt_59YVZA8IA8o2egRuHhPMh4OOTNdFLPyy2z65oun7A7T75qdtMxB9Gx2g6hdqG7a6CoFl7wbFQ5OqSxcViSThFyQsbrrOF2K3eSm2S5yLloAGrV9xlvJmEFK-mPaQa76VxZBF-w06tpKTQ_Ecu_J9NqQcflv5Lxn_pdg9JpuXZou5PV-r29n5aUgmxkh1RVsTN382"
  }
];

const CATEGORIES = ['Electronics', 'Office Supplies', 'Industrial Tools', 'Packaging'];

export default function ProductCatalogApp() {
  const [activeCategory, setActiveCategory] = useState('Electronics');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className='font-sans bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white min-h-screen flex flex-col relative'>
      {/* Header Section */}
      <header className='sticky top-0 z-50 bg-white dark:bg-[#101922] border-b border-gray-200 dark:border-gray-800'>
        <div className='flex items-center px-4 pt-10 pb-2 justify-between'>
          <button className='text-[#111418] dark:text-white flex size-10 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors'>
            <Menu size={24} />
          </button>
          <h1 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-tight flex-1 text-center'>
            Product Catalog
          </h1>
          <button className='text-[#111418] dark:text-white flex size-10 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors'>
            <Bell size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className='px-4 py-3 bg-white dark:bg-[#101922]'>
          <div className='flex flex-col min-w-40 h-11 w-full'>
            <div className='flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden'>
              <div className='text-[#617589] dark:text-gray-400 flex border-none bg-[#f0f2f4] dark:bg-gray-800 items-center justify-center pl-4 rounded-l-lg'>
                <Search size={20} />
              </div>
              <input 
                className='flex w-full min-w-0 flex-1 border-none bg-[#f0f2f4] dark:bg-gray-800 text-[#111418] dark:text-white focus:ring-0 placeholder:text-[#617589] px-4 rounded-r-lg pl-2 text-sm font-normal outline-none'
                placeholder='Search by SKU or Name...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Categories (Horizontal Scroll) */}
        <div className='overflow-x-auto no-scrollbar bg-white dark:bg-[#101922]'>
          <div className='flex border-b border-gray-100 dark:border-gray-800 px-4 gap-6 min-w-max'>
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-2 transition-colors ${
                    isActive
                      ? 'border-[#137fec] text-[#137fec]'
                      : 'border-transparent text-[#617589] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white'
                  }`}
                >
                  <p className={`text-sm tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {cat}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1 overflow-y-auto'>
        <div className='p-4'>
          {/* Controls */}
          <div className='flex items-center justify-between mb-4'>
            <p className='text-sm font-medium text-[#617589] dark:text-gray-400'>
              Showing 124 products
            </p>
            <div className='flex gap-2'>
              <button className='p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'>
                <Filter size={18} />
              </button>
              <button className='p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'>
                <LayoutGrid size={18} />
              </button>
            </div>
          </div>

          {/* Product Grid */}
          <div className='grid grid-cols-2 gap-4 pb-24'>
            {PRODUCTS.map((product) => (
              <ProductCard key={product.id} data={product} />
            ))}
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <div className='fixed bottom-24 right-6 z-40'>
        <button className='flex size-14 items-center justify-center rounded-full bg-[#137fec] text-white shadow-xl shadow-[#137fec]/40 active:scale-90 transition-transform'>
          <Plus size={24} />
        </button>
      </div>

      {/* Bottom Navigation */}
      <nav className='fixed bottom-0 w-full bg-white dark:bg-[#101922] border-t border-gray-200 dark:border-gray-800 pb-8 pt-3 px-4 flex justify-around items-center z-50'>
        <NavButton icon={Home} label='Home' active />
        <NavButton icon={FileText} label='Demand' />
        <NavButton icon={ShoppingCart} label='Cart' badge='3' />
        <NavButton icon={ScrollText} label='Orders' />
        <NavButton icon={User} label='Mine' />
      </nav>
    </div>
  );
}

// Sub-components

function ProductCard({ data }) {
  return (
    <div className='bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col'>
      {/* Image Area */}
      <div 
        className='relative w-full aspect-square bg-[#f0f2f4] dark:bg-gray-800 bg-center bg-no-repeat bg-cover'
        style={{ backgroundImage: `url("${data.image}")` }}
      >
        <div className='absolute top-2 left-2 bg-white/90 dark:bg-black/60 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-[#111418] dark:text-white'>
          SKU: {data.sku}
        </div>
      </div>

      {/* Details */}
      <div className='p-3 flex flex-col flex-1'>
        <h3 className='text-[#111418] dark:text-white text-sm font-semibold leading-tight mb-1 line-clamp-2'>
          {data.title}
        </h3>
        <p className='text-[#137fec] text-base font-bold leading-normal'>
          {data.price}
        </p>
        <p className='text-[#617589] dark:text-gray-400 text-[11px] font-medium leading-normal mb-3'>
          {data.minUnits}
        </p>
        
        {/* Footer: Tag + Add Button */}
        <div className='mt-auto flex items-center justify-between'>
          <span className='text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-[#617589] dark:text-gray-400'>
            {data.tag}
          </span>
          <button className='size-9 bg-[#137fec] text-white rounded-lg flex items-center justify-center shadow-lg shadow-[#137fec]/20 active:scale-95 transition-transform'>
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active = false, badge = '' }) {
  return (
    <button className={`flex flex-col items-center gap-1 relative ${active ? 'text-[#137fec]' : 'text-[#617589] dark:text-gray-400'}`}>
      <div className='relative'>
        <Icon size={24} strokeWidth={active ? 2.5 : 2} />
        {badge && (
          <span className='absolute -top-1 -right-1 bg-[#137fec] text-white text-[8px] font-bold px-1 rounded-full min-w-[14px] flex items-center justify-center'>
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>
        {label}
      </span>
    </button>
  );
}
