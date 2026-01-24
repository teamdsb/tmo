import { useState } from 'react';
import { 
  ChevronLeft, 
  Share2, 
  Heart, 
  Star, 
  Truck, 
  ChevronRight,
  Handshake, 
  ShoppingCart, 
  Home, 
  Compass, 
  ClipboardList, 
  User 
} from 'lucide-react';

export default function ProductDetail() {
  // State for selections
  const [selectedMaterial, setSelectedMaterial] = useState('Stainless Steel');
  const [selectedSize, setSelectedSize] = useState('50mm');
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className='min-h-screen font-sans bg-[#f8f9fa] text-slate-900 pb-24'>
      
      {/* --- Header --- */}
      <header className='fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100'>
        <div className='flex items-center h-12 px-4 max-w-md mx-auto justify-between'>
          <div className='flex items-center gap-3'>
            <button className='flex items-center justify-center'>
              <ChevronLeft size={24} className='text-slate-900' />
            </button>
            <span className='text-sm font-semibold truncate max-w-[180px]'>Control Valve SKU-902</span>
          </div>
          <div className='flex items-center gap-4'>
            <button onClick={() => setIsFavorite(!isFavorite)}>
              <Heart 
                size={20} 
                className={isFavorite ? "text-red-500 fill-red-500" : "text-slate-900"} 
              />
            </button>
            <button>
              <Share2 size={20} className='text-slate-900' />
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className='max-w-md mx-auto pt-12 pb-44'>
        
        {/* Product Image Area */}
        <div className='relative bg-white'>
          <div className='aspect-[4/3] overflow-hidden'>
            <img 
              alt='Product' 
              className='w-full h-full object-cover' 
              src='https://lh3.googleusercontent.com/aida-public/AB6AXuCspf7tkk3Cwf2GD5lYQaNodcqBkcYqB_ZBv1e2fVDNw0YMOKkHumvzpQ1mZEKdercQH0hJKeoDWuFaFd0qoHzNg0huzTlzC5-zZ7kBXvWE9Ib08FjC_NddG0UAEIhtDzvhKWIoHFuCHwDIbw0VxEiTfUHw5E2lSdd55A_492g3TzsAwCF8m_qM_vrA2FUIFmA556OMpdd6XsGANJE4w1E8t6cLo6tKrJi7WMOnV3ErcUQcrzM2zDWv12Q92-EVBL6NJcTileQoBmGI'
            />
          </div>
          <div className='absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full font-medium'>
            1/4
          </div>
        </div>

        {/* Product Info Header */}
        <div className='bg-white px-4 py-4 border-b border-slate-50'>
          <div className='flex justify-between items-start gap-4'>
            <h1 className='text-lg font-bold leading-tight text-slate-900'>
              High-Precision Industrial Control Valve
            </h1>
            <div className='flex flex-col items-end shrink-0'>
              <span className='text-[#137fec] text-xl font-bold'>$185.00</span>
              <span className='text-[10px] text-slate-400 font-medium uppercase tracking-tight'>Per Unit (Min 10)</span>
            </div>
          </div>
          
          <div className='mt-2 flex items-center gap-3'>
            <div className='flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded'>
              <Star size={12} className='text-amber-500 fill-amber-500' />
              <span className='text-[11px] font-bold text-amber-700'>4.8</span>
            </div>
            <span className='text-xs text-slate-400'>1.2k+ Sold</span>
            <span className='text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold uppercase'>Verified</span>
          </div>
        </div>

        {/* Bulk Pricing */}
        <div className='bg-white mt-2 p-4'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-xs font-bold text-slate-400 uppercase tracking-wider'>Bulk Pricing</h3>
            <span className='text-[#137fec] text-[11px] font-semibold'>Volume Discounts</span>
          </div>
          
          <div className='grid grid-cols-3 gap-2'>
            {/* Tier 1 */}
            <div className='bg-slate-50 p-3 rounded-lg border border-transparent'>
              <p className='text-[10px] text-slate-500 font-medium'>10-49</p>
              <p className='text-sm font-bold'>$245.00</p>
            </div>
            
            {/* Tier 2 (Highlighted) */}
            <div className='bg-[#137fec]/5 p-3 rounded-lg border border-[#137fec]/20 ring-1 ring-[#137fec]/10'>
              <p className='text-[10px] text-[#137fec] font-bold uppercase tracking-tighter'>50-199</p>
              <p className='text-sm font-bold text-[#137fec]'>$210.00</p>
              <p className='text-[9px] text-green-600 font-bold'>-14%</p>
            </div>
            
            {/* Tier 3 */}
            <div className='bg-slate-50 p-3 rounded-lg border border-transparent'>
              <p className='text-[10px] text-slate-500 font-medium'>200+</p>
              <p className='text-sm font-bold'>$185.00</p>
              <p className='text-[9px] text-green-600 font-bold'>-24%</p>
            </div>
          </div>
        </div>

        {/* Selection Variants */}
        <div className='bg-white mt-2 p-4'>
          {/* Material Selection */}
          <div className='mb-5'>
            <div className='flex justify-between mb-2'>
              <span className='text-xs font-bold text-slate-400 uppercase tracking-wider'>Material</span>
              <span className='text-xs font-medium text-slate-900'>{selectedMaterial}</span>
            </div>
            <div className='flex flex-wrap gap-2'>
              {['Stainless Steel', 'Carbon', 'Alloy X-40'].map((mat) => {
                 const isSelected = selectedMaterial === mat;
                 // Mapping 'Stainless Steel' to 'Stainless' for display to match HTML sample if needed, 
                 // keeping logic simple here.
                 const displayLabel = mat === 'Stainless Steel' ? 'Stainless' : mat;
                 
                 return (
                  <button
                    key={mat}
                    onClick={() => setSelectedMaterial(mat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected 
                        ? 'border border-[#137fec] bg-[#137fec] text-white font-semibold' 
                        : 'border border-slate-200 text-slate-600'
                    }`}
                  >
                    {displayLabel}
                  </button>
                 );
              })}
            </div>
          </div>

          {/* Diameter Selection */}
          <div>
            <div className='flex justify-between mb-2'>
              <span className='text-xs font-bold text-slate-400 uppercase tracking-wider'>Diameter</span>
              <span className='text-xs font-medium text-slate-900'>{selectedSize}</span>
            </div>
            <div className='flex flex-wrap gap-2'>
              {['15mm', '25mm', '50mm', '75mm'].map((size) => {
                const isSelected = selectedSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[48px] px-3 py-1.5 rounded-md text-xs transition-all ${
                      isSelected 
                        ? 'border-2 border-[#137fec] text-[#137fec] font-bold' 
                        : 'border border-slate-200 text-slate-600 font-medium'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className='bg-white mt-2 p-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Truck size={20} className='text-slate-400' />
              <div>
                <p className='text-xs font-semibold'>Standard Air Freight</p>
                <p className='text-[10px] text-slate-400'>Arrives Sep 12 - Sep 18</p>
              </div>
            </div>
            <ChevronRight size={18} className='text-slate-400' />
          </div>
        </div>
      </main>

      {/* --- Action Bar --- */}
      <div className='fixed bottom-[72px] left-0 right-0 z-40 px-4'>
        <div className='max-w-md mx-auto flex gap-3'>
          <button className='flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold text-sm shadow-sm active:scale-95 transition-transform'>
            <Handshake size={20} />
            <span>Bargain</span>
          </button>
          <button className='flex-[1.5] h-12 flex items-center justify-center gap-2 rounded-xl bg-[#137fec] text-white font-bold text-sm shadow-lg shadow-[#137fec]/20 active:scale-95 transition-transform'>
            <ShoppingCart size={20} />
            <span>Add to Cart</span>
          </button>
        </div>
      </div>

      {/* --- Bottom Navigation --- */}
      <nav className='fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 pb-safe'>
        <div className='max-w-md mx-auto h-16 flex justify-around items-center px-2'>
          <NavItem icon={Home} label='Home' />
          <NavItem icon={Compass} label='Demand' />
          
          {/* Cart Item - Active state example */}
          <div className='flex flex-col items-center gap-1 cursor-pointer relative text-[#137fec]'>
            <ShoppingCart size={24} />
            <span className='text-[10px] font-medium'>Cart</span>
            <span className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white border-2 border-white'>2</span>
          </div>

          <NavItem icon={ClipboardList} label='Orders' />
          <NavItem icon={User} label='Mine' />
        </div>
      </nav>

    </div>
  );
}

// Helper Component for Navigation Items
function NavItem({ icon: Icon, label }) {
  return (
    <button className='flex flex-col items-center gap-1 cursor-pointer group'>
      <Icon size={24} className='text-slate-400 group-hover:text-slate-500 transition-colors' />
      <span className='text-[10px] font-medium text-slate-500 group-hover:text-slate-600'>
        {label}
      </span>
    </button>
  );
}
