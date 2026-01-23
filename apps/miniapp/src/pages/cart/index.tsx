import { useState } from 'react';
import { 
  ChevronLeft, 
  AlertCircle, 
  HelpCircle, 
  Table, 
  Box, 
  MoreHorizontal, 
  Home, 
  BarChart2, 
  ShoppingCart, 
  ClipboardList, 
  User, 
  ArrowRight
} from 'lucide-react';

export default function ExcelImportConfirmation() {
  const [activeTab, setActiveTab] = useState('to-confirm');

  // 模拟待确认的数据
  const pendingItems = [
    {
      id: 1,
      name: "M10 Bolt 50mm Zinc",
      issue: "Ambiguous match: 4 sizes available",
      row: 4,
      icon: <HelpCircle size={24} />,
      btnText: "Select Spec"
    },
    {
      id: 2,
      name: "Industrial Adhesive G9",
      issue: "Volume not specified",
      row: 12,
      icon: <HelpCircle size={24} />,
      btnText: "Select Spec"
    },
    {
      id: 3,
      name: "Steel Washers (Box 100)",
      issue: "Multiple material grades",
      row: 25,
      icon: <HelpCircle size={24} />,
      btnText: "Select Spec"
    }
  ];

  // 模拟已确认的数据
  const confirmedItems = [
    { id: 101, name: "Pneumatic Hose 10m", qty: "25 units" },
    { id: 102, name: "Safety Gloves XL", qty: "50 pairs" },
  ];

  return (
    <div className='font-sans bg-[#f6f7f8] dark:bg-[#101922] min-h-screen flex justify-center text-[#111418] dark:text-white transition-colors duration-200'>
      
      {/* 模拟移动端容器 */}
      <div className='relative flex min-h-screen w-full flex-col max-w-[430px] bg-white dark:bg-[#111418] shadow-2xl overflow-x-hidden'>
        
        {/* Header - Sticky */}
        <div className='sticky top-0 z-20 bg-white/80 dark:bg-[#111418]/80 backdrop-blur-md'>
          <div className='flex items-center p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800'>
            <div className='text-[#111418] dark:text-white flex size-10 shrink-0 items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors'>
              <ChevronLeft size={24} />
            </div>
            <h2 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10'>
              Import Results
            </h2>
          </div>
        </div>

        {/* Main Content Area */}
        <div className='flex-1 pb-44'>
          
          {/* Status Overview */}
          <div className='flex flex-col gap-3 p-4 bg-white dark:bg-[#111418]'>
            <div className='flex gap-6 justify-between items-end'>
              <div>
                <p className='text-[#111418] dark:text-white text-xl font-bold leading-tight'>15 Items Found</p>
                <p className='text-[#617589] dark:text-gray-400 text-sm font-normal'>Ready for your review</p>
              </div>
              <p className='text-[#137fec] text-sm font-semibold leading-normal'>12/15 Identified</p>
            </div>
            
            {/* Progress Bar */}
            <div className='rounded-full bg-[#dbe0e6] dark:bg-gray-700 h-2 overflow-hidden'>
              <div className='h-full rounded-full bg-[#137fec]' style={{ width: '80%' }}></div>
            </div>
            
            <div className='flex items-center gap-2'>
              <AlertCircle size={18} className='text-amber-500' />
              <p className='text-[#617589] dark:text-gray-400 text-sm font-medium leading-normal'>
                3 items require specification choice
              </p>
            </div>
          </div>

          {/* Tab Switcher - Sticky */}
          <div className='flex px-4 py-4 sticky top-[61px] z-10 bg-white dark:bg-[#111418]'>
            <div className='flex h-11 flex-1 items-center justify-center rounded-xl bg-[#f0f2f4] dark:bg-gray-800 p-1'>
              {/* To Confirm Tab */}
              <label 
                onClick={() => setActiveTab('to-confirm')}
                className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition-all ${
                  activeTab === 'to-confirm' 
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-[#137fec]' 
                    : 'text-[#617589] dark:text-gray-400'
                }`}
              >
                <span className='truncate text-sm font-semibold leading-normal'>To Confirm (3)</span>
                <input 
                  type='radio' 
                  name='tab-group' 
                  className='hidden' 
                  checked={activeTab === 'to-confirm'}
                  readOnly
                />
              </label>
              
              {/* Confirmed Tab */}
              <label 
                onClick={() => setActiveTab('confirmed')}
                className={`flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 transition-all ${
                  activeTab === 'confirmed' 
                    ? 'bg-white dark:bg-gray-700 shadow-sm text-[#137fec]' 
                    : 'text-[#617589] dark:text-gray-400'
                }`}
              >
                <span className='truncate text-sm font-semibold leading-normal'>Confirmed (12)</span>
                <input 
                  type='radio' 
                  name='tab-group' 
                  className='hidden' 
                  checked={activeTab === 'confirmed'}
                  readOnly
                />
              </label>
            </div>
          </div>

          {/* List Content */}
          <div className='flex flex-col'>
            <h3 className='text-[#111418] dark:text-white text-xs font-bold uppercase tracking-wider px-4 pb-2 pt-2 opacity-60'>
              Items needing attention
            </h3>
            
            {/* List Items */}
            {pendingItems.map((item) => (
              <div key={item.id} className='flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800 last:border-0'>
                <div className='flex gap-4 bg-white dark:bg-[#111418] px-4 py-4 justify-between items-start'>
                  <div className='flex items-start gap-4'>
                    <div className='text-[#137fec] flex items-center justify-center rounded-xl bg-[#137fec]/10 shrink-0 size-12'>
                      {item.icon}
                    </div>
                    <div className='flex flex-1 flex-col'>
                      <p className='text-[#111418] dark:text-white text-base font-semibold leading-tight'>
                        {item.name}
                      </p>
                      <p className='text-amber-600 dark:text-amber-400 text-xs font-medium mt-1'>
                        {item.issue}
                      </p>
                      <div className='flex items-center gap-1 mt-2 text-[#617589] dark:text-gray-500'>
                        <Table size={14} />
                        <p className='text-xs font-normal'>Excel Row: {item.row}</p>
                      </div>
                    </div>
                  </div>
                  <div className='shrink-0'>
                    <button className='flex min-w-[100px] cursor-pointer items-center justify-center rounded-lg h-9 px-3 bg-[#137fec] text-white text-xs font-bold leading-normal shadow-sm active:scale-95 transition-transform hover:bg-[#137fec]/90'>
                      {item.btnText}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Horizontal Scroll Section */}
            <div className='mt-6 flex items-center justify-between px-4 pb-2'>
              <h3 className='text-[#111418] dark:text-white text-xs font-bold uppercase tracking-wider opacity-60'>
                Already Confirmed
              </h3>
              <span className='text-xs font-semibold text-[#137fec] cursor-pointer hover:underline'>View All</span>
            </div>

            <div className='flex gap-4 overflow-x-auto px-4 py-2 no-scrollbar mb-8 scroll-smooth'>
              {confirmedItems.map((item) => (
                <div key={item.id} className='min-w-[140px] bg-[#f6f7f8] dark:bg-gray-800 p-3 rounded-xl flex flex-col gap-2 shrink-0'>
                  <div className='w-full aspect-square bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center'>
                    <Box size={24} className='text-gray-400' />
                  </div>
                  <p className='text-xs font-bold truncate'>{item.name}</p>
                  <p className='text-[10px] text-gray-500'>{item.qty}</p>
                </div>
              ))}
              
              {/* More Card */}
              <div className='min-w-[140px] bg-[#f6f7f8] dark:bg-gray-800 p-3 rounded-xl flex flex-col gap-2 opacity-50 shrink-0'>
                <div className='w-full aspect-square bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center'>
                  <MoreHorizontal size={24} className='text-gray-400' />
                </div>
                <p className='text-xs font-bold truncate'>+10 More items</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Fixed Area (Footer + Nav) */}
        <div className='fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white/90 dark:bg-[#111418]/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 z-30'>
          
          {/* Action Bar */}
          <div className='px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#111418]/50'>
            <div className='flex flex-col'>
              <p className='text-[#617589] dark:text-gray-400 text-[10px] font-medium uppercase tracking-wider'>
                Subtotal (12 items)
              </p>
              <p className='text-[#111418] dark:text-white text-base font-bold leading-tight'>
                $1,452.80
              </p>
            </div>
            <button className='bg-[#137fec] hover:bg-[#137fec]/90 text-white font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-[#137fec]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm'>
              <span>Add to Cart</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Bottom Navigation */}
          <div className='flex items-center justify-around py-3 px-2 pb-8'>
            <NavItem icon={<Home size={24} />} label='Home' />
            <NavItem icon={<BarChart2 size={24} />} label='Demand' />
            <NavItem icon={<ShoppingCart size={24} />} label='Cart' active badge='12' />
            <NavItem icon={<ClipboardList size={24} />} label='Orders' />
            <NavItem icon={<User size={24} />} label='Mine' />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Component for Navigation Items
function NavItem({ icon, label, active = false, badge = '' }) {
  const activeClass = active ? 'text-[#137fec]' : 'text-[#617589] group-hover:text-[#137fec]';
  
  return (
    <a className='flex flex-col items-center gap-1 group cursor-pointer' href='#'>
      <div className={`relative ${activeClass} transition-colors`}>
        {icon}
        {badge && (
          <span className='absolute -top-1 -right-2 flex h-3 w-3 items-center justify-center rounded-full bg-[#137fec] text-[8px] text-white font-bold px-1'>
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-medium ${active ? 'font-bold' : ''} ${activeClass} transition-colors`}>
        {label}
      </span>
    </a>
  );
}
