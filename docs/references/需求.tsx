import React, { useState } from 'react';
import { 
  ChevronLeft, 
  NotebookPen, 
  ChevronDown, 
  SlidersHorizontal, 
  Plus, 
  Image as ImageIcon, 
  X, 
  ImagePlus, 
  Send
} from 'lucide-react';

// 自定义颜色定义，对应原 HTML 中的 tailwind.config
const colors = {
  primary: '#137fec',
  bgLight: '#f6f7f8',
  bgDark: '#101922',
};

export default function App() {
  // 状态管理
  const [formData, setFormData] = useState({
    productName: '',
    category: '',
    quantity: '',
    material: 'Plastic',
    dimensions: '',
    color: 'Standard'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleColorChange = (color: string) => {
    setFormData(prev => ({ ...prev, color }));
  };

  return (
    <div className="min-h-screen flex flex-col antialiased selection:bg-[#137fec]/20 selection:text-[#137fec] bg-[#f6f7f8] dark:bg-[#101922] text-slate-800 dark:text-slate-100 font-sans">
      {/* 注入 Google Font: Manrope */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      `}</style>

      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-[#101922]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 h-14">
          <button className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-[#137fec] dark:hover:text-[#137fec] transition-colors rounded-full active:bg-slate-100 dark:active:bg-slate-800">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">定制需求</h1>
          <div className="w-8"></div> {/* 占位符 */}
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="flex-1 px-4 py-6 space-y-6 pb-32">
        
        {/* 卡片 1: 基本信息 */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#137fec]/10 flex items-center justify-center text-[#137fec]">
              <NotebookPen size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">基本信息</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="product_name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                产品名称
              </label>
              <input 
                id="product_name"
                name="productName"
                type="text"
                value={formData.productName}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] outline-none text-sm py-2.5 px-3 transition-shadow shadow-sm"
                placeholder="例如：无线降噪耳机"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="category" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                产品类目
              </label>
              <div className="relative">
                <select 
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] outline-none text-sm py-2.5 px-3 pr-10 appearance-none shadow-sm transition-shadow"
                >
                  <option value="" disabled>选择产品类目</option>
                  <option value="electronics">消费电子</option>
                  <option value="apparel">服装时尚</option>
                  <option value="home">家居园艺</option>
                  <option value="industrial">工业机械</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 卡片 2: 规格参数 */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#137fec]/10 flex items-center justify-center text-[#137fec]">
              <SlidersHorizontal size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">规格参数</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 数量 */}
            <div className="col-span-2 space-y-1.5">
              <label htmlFor="quantity" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                目标数量
              </label>
              <div className="relative flex items-center">
                <input 
                  id="quantity"
                  name="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] outline-none text-sm py-2.5 px-3 shadow-sm transition-shadow"
                  placeholder="起订量 500+"
                />
                <span className="absolute right-3 text-xs font-medium text-slate-400 uppercase">单位</span>
              </div>
            </div>

            {/* 材质 */}
            <div className="col-span-1 space-y-1.5">
              <label htmlFor="material" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                材质
              </label>
              <div className="relative">
                <select 
                  id="material"
                  name="material"
                  value={formData.material}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] outline-none text-sm py-2.5 px-3 appearance-none shadow-sm transition-shadow"
                >
                  <option value="Plastic">塑料</option>
                  <option value="Metal">金属</option>
                  <option value="Wood">木材</option>
                  <option value="Fabric">布料</option>
                  <option value="Other">其他</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                   <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* 尺寸 */}
            <div className="col-span-1 space-y-1.5">
              <label htmlFor="dimensions" className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                尺寸 (cm)
              </label>
              <input 
                id="dimensions"
                name="dimensions"
                type="text"
                value={formData.dimensions}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#137fec] focus:ring-1 focus:ring-[#137fec] outline-none text-sm py-2.5 px-3 shadow-sm transition-shadow"
                placeholder="长 x 宽 x 高"
              />
            </div>

            {/* 颜色选择 */}
            <div className="col-span-2 space-y-2 mt-1">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                首选颜色
              </label>
              <div className="flex flex-wrap gap-2">
                <ColorChip 
                  label="标准" 
                  value="Standard" 
                  selected={formData.color === 'Standard'} 
                  onClick={() => handleColorChange('Standard')} 
                />
                <ColorChip 
                  label="黑色" 
                  value="Black" 
                  selected={formData.color === 'Black'} 
                  onClick={() => handleColorChange('Black')} 
                />
                <ColorChip 
                  label="白色" 
                  value="White" 
                  selected={formData.color === 'White'} 
                  onClick={() => handleColorChange('White')} 
                />
                <ColorChip 
                  label="自定义" 
                  value="Custom" 
                  isCustom
                  selected={formData.color === 'Custom'} 
                  onClick={() => handleColorChange('Custom')} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* 卡片 3: 参考图片 */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#137fec]/10 flex items-center justify-center text-[#137fec]">
                <ImageIcon size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">参考图片</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">选填</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* 现有图片示例 */}
            <div className="relative aspect-square rounded-lg overflow-hidden border border-slate-100 dark:border-slate-600 group cursor-pointer">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA74N45E5iut6souQW6eoJcAY76bc7mcnSuSdwBupBLRLDYaNJCWZEQCCkWR5N36ZyQoTKwnYcow76HUNEX_3sOJ0FGjlbUcDqSeVkwU5QbzVf8bpCp4x_je4HB9OQkkjQVIPATeCGg2kuVotxPJGxjEabYd4J57Dr2OS1CpBdD0oIZLGhF6Ibfn7OZBlq73oe1DSdB-05HC307DCMCmeAKckyK87xVC3zrywu_k-uLWYHTBMBqn0zyDtWPHQAj_jNdupfBuVawzjo"
                alt="无线耳机产品草图" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button className="text-white bg-red-500 rounded-full p-1 hover:bg-red-600 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 上传占位符 */}
            <button className="aspect-square rounded-lg border-2 border-dashed border-[#137fec]/30 hover:border-[#137fec]/60 bg-[#137fec]/5 hover:bg-[#137fec]/10 transition-all flex flex-col items-center justify-center gap-1 group">
              <ImagePlus className="text-[#137fec]/60 group-hover:text-[#137fec] transition-colors" size={24} />
              <span className="text-[10px] font-semibold text-[#137fec]/70 group-hover:text-[#137fec] uppercase tracking-wider">添加</span>
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">
            上传清晰的草图或参考照片。支持格式：JPG, PNG, PDF (最大 5MB)。
          </p>
        </section>
      </main>

      {/* 底部悬浮操作区 (适配 iPhone 底部安全区) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#101922]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800">
        <div className="px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <button className="w-full bg-[#137fec] hover:bg-blue-600 active:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#137fec]/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2">
            <span>提交需求</span>
            <Send size={18} />
          </button>
        </div>
      </div>

    </div>
  );
}

// 子组件: 颜色选择 Chip
interface ColorChipProps {
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
  isCustom?: boolean;
}

function ColorChip({ label, selected, onClick, isCustom }: ColorChipProps) {
  return (
    <label className="cursor-pointer">
      <input 
        type="radio" 
        className="peer sr-only" 
        name="color" 
        checked={selected}
        onChange={onClick}
      />
      <div className={`px-3 py-1.5 rounded-full border text-sm transition-all flex items-center gap-1
        ${selected 
          ? 'bg-[#137fec] text-white border-[#137fec]' 
          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}
      >
        {isCustom && <Plus size={14} />}
        {label}
      </div>
    </label>
  );
}