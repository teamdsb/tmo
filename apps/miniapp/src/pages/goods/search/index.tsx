import { useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
// If using plain React Native/Taro without auto-imports:
// import Taro from '@tarojs/taro';

export default function SearchEmptyState() {
  const [searchValue, setSearchValue] = useState("Industrial Drill 5000");

  // Mock data for the recommendations grid
  const recommendations = [
    {
      id: 1,
      title: "Heavy Duty Pump G-400",
      price: "$1,220.00",
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCY5JYrFhnIoUuDG0ic4fBnO7KDMeNonFlELbfSZFt7fkidRSCoWKSTt72p6BlP2PFRUxBx3YTlLhLCN1nfWo7RbXFDn8F6YtukSKLy2i_5143WkApJH69tkMK6C0x0L7BYassAq11KJibdiVKnXxDHWggwOJQoyT6XTkDORecfo21pWRRfdt1N0cjPfBMcBOhBQr-g_lK09_8GAYiHCQqQogNUnlMNP4c1ZF1_Oq4vxPgE8Pr2K1O6NsC6Vh7fjGcIH9WfT5GcNLYH",
      badgeText: "In stock",
      badgeColor: "bg-green-500"
    },
    {
      id: 2,
      title: "High-Grade Steel Coupler",
      price: "$45.50",
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDqcO0ZsF478oZ2ptOGZ-USmvK1N6w1JKiG3NEuzCtVxtUYWGTjb9CQMSPcvIx_0Jt3TrSDyA1QZ1SMSk7MCkIZ5P3VdLbub-OlzJZZmVGtjO8I4AE81fs3qbZYJkARLwmxi2WPUqLMJPKcODqfdGwfWx-2odJQMiiU8pN4dvpQF43Qqh8o7InQwDdm56riyjAsS6gYCgm6vjmxijmdB80iIMPDuEdjM_Ul5VaH_XgGIOEP4yBu8A5R7RPW0UphBnG6fHZUW3pOMtrk",
      badgeText: "Low stock",
      badgeColor: "bg-orange-500"
    }
  ];

  return (
    <View className='bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display'>
      <View className='max-w-[430px] mx-auto bg-white dark:bg-background-dark min-h-screen flex flex-col shadow-xl w-full'>
        
        {/* === Header Section === */}
        <View className='sticky top-0 z-10 bg-white dark:bg-background-dark/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800'>
          <View className='flex items-center p-4 pb-2 justify-between'>
            <View className='text-[#111418] dark:text-white flex w-10 h-10 shrink-0 items-center justify-center'>
              <Text className='material-symbols-outlined'>arrow_back_ios</Text>
            </View>
            <Text className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center'>
              Search Results
            </Text>
            <View className='flex w-10 items-center justify-end'>
              <View className='flex items-center justify-center rounded-lg h-10 w-10 bg-transparent text-[#111418] dark:text-white'>
                <Text className='material-symbols-outlined'>more_horiz</Text>
              </View>
            </View>
          </View>

          {/* Search Bar */}
          <View className='px-4 py-3'>
            <View className='flex flex-col w-full h-11'>
              <View className='flex w-full flex-1 items-stretch rounded-lg h-full overflow-hidden shadow-sm'>
                <View className='text-[#617589] flex border-none bg-gray-100 dark:bg-gray-800 items-center justify-center pl-4'>
                  <Text className='material-symbols-outlined text-sm'>search</Text>
                </View>
                {/* Taro Input uses onInput instead of onChange for typing events */}
                <Input 
                  className='flex w-full min-w-0 flex-1 h-full border-none bg-gray-100 dark:bg-gray-800 text-[#111418] dark:text-white px-3 text-base font-normal leading-normal placeholder:text-[#617589]'
                  value={searchValue}
                  onInput={(e) => setSearchValue(e.detail.value)}
                  placeholder='Search products...'
                />
                <View className='flex items-center justify-center border-none bg-gray-100 dark:bg-gray-800 pr-3'>
                  <View 
                    className='flex items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600 p-0.5'
                    onClick={() => setSearchValue('')}
                  >
                    <Text className='material-symbols-outlined text-[16px] text-white'>close</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* === Main Content (Scrollable) === */}
        <ScrollView scrollY className='flex-1'>
          <View className='flex flex-col px-6 py-12'>
            
            {/* Empty State Illustration */}
            <View className='flex flex-col items-center gap-8'>
              <View className='aspect-square w-48 flex items-center justify-center rounded-full bg-primary/5 dark:bg-primary/10 border-4 border-primary/10'>
                <Text 
                  className='material-symbols-outlined text-primary text-6xl opacity-40' 
                  style={{ fontSize: '60px' }} // Inline style often needed for specific icon sizing in Taro if tailwind classes fail
                >
                  inventory_2
                </Text>
              </View>
              
              <View className='flex flex-col items-center gap-3 text-center'>
                <Text className='text-[#111418] dark:text-white text-xl font-bold leading-tight tracking-tight'>
                  No products found
                </Text>
                <View className='max-w-[280px]'>
                    <Text className='text-[#617589] dark:text-gray-400 text-sm font-normal leading-relaxed'>
                    We couldn&apos;t find matches for <Text className='font-semibold text-primary'>&quot;{searchValue}&quot;</Text>. Try adjusting your keywords or submit a direct request.
                    </Text>
                </View>
              </View>

              <View className='w-full flex flex-col gap-3'>
                <View className='flex w-full items-center justify-center overflow-hidden rounded-lg h-14 px-6 bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform'>
                  <Text className='material-symbols-outlined mr-2'>post_add</Text>
                  <Text className='text-base font-bold leading-normal tracking-wide truncate'>Submit a Demand Request</Text>
                </View>
                <Text className='text-[#617589] dark:text-gray-500 text-xs text-center px-4'>
                  Our sourcing team will contact you with quotes within 24 hours.
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View className='h-2 bg-background-light dark:bg-gray-900'></View>

          {/* Recommendations Header */}
          <View className='flex items-center justify-between px-4 pt-6 pb-2'>
            <Text className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]'>
              Recommended for You
            </Text>
            <Text className='text-primary text-sm font-medium'>See all</Text>
          </View>

          {/* Recommendations Grid */}
          <View className='grid grid-cols-2 gap-4 p-4'>
            {recommendations.map((item) => (
              <View key={item.id} className='flex flex-col gap-3 group'>
                <View 
                  className='relative w-full bg-center bg-no-repeat aspect-square bg-cover rounded-xl overflow-hidden shadow-sm bg-gray-200'
                  style={{ backgroundImage: `url("${item.image}")` }}
                >
                  <View className={`absolute top-2 left-2 ${item.badgeColor} text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase`}>
                    {item.badgeText}
                  </View>
                </View>
                <View className='px-1'>
                  <Text className='text-[#111418] dark:text-white text-sm font-semibold leading-snug block overflow-hidden whitespace-nowrap text-ellipsis'>
                    {item.title}
                  </Text>
                  <View className='flex items-center justify-between mt-1'>
                    <Text className='text-primary text-base font-bold'>{item.price}</Text>
                    <Text className='material-symbols-outlined text-[#617589] text-lg'>add_circle</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          
          {/* Spacer for bottom nav */}
          <View className='h-10'></View>
        </ScrollView>

        {/* === Bottom Navigation === */}
        <View className='bg-white dark:bg-background-dark border-t border-gray-100 dark:border-gray-800 px-6 py-2 pb-8 flex justify-between items-center sticky bottom-0 z-20'>
          <NavItem icon='home' label='Home' active />
          <NavItem icon='description' label='Demand' />
          
          <View className='flex flex-col items-center gap-1 text-gray-400'>
            <View className='relative'>
              <Text className='material-symbols-outlined'>shopping_cart</Text>
              <View className='absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500'>
                 <Text className='text-[8px] text-white'>2</Text>
              </View>
            </View>
            <Text className='text-[11px] font-medium'>Cart</Text>
          </View>
          
          <NavItem icon='assignment' label='Orders' />
          <NavItem icon='person' label='Mine' />
        </View>

      </View>
    </View>
  );
}

// Helper component for Nav Items
const NavItem = ({ icon, label, active = false }) => (
  <View className={`flex flex-col items-center gap-1 ${active ? 'text-primary' : 'text-gray-400'}`}>
    <Text className='material-symbols-outlined'>{icon}</Text>
    <Text className='text-[11px] font-medium'>{label}</Text>
  </View>
);
