import { View, Text, Input, ScrollView } from '@tarojs/components'
import styles from './index.module.scss'

type LinkStatus = 'Linked' | 'Unlinked' | 'VIP'

type CustomerItem = {
  id: string
  name: string
  email: string
  linkStatus: LinkStatus
  linkedTo?: string
  initials: string
}

const customers: CustomerItem[] = [
  { id: 'c1', name: 'Alice Smith', email: 'alice@example.com', linkStatus: 'Linked', linkedTo: 'Mark Johnson', initials: 'AS' },
  { id: 'c2', name: 'Bob Jones', email: 'bob.jones@example.com', linkStatus: 'Unlinked', initials: 'BJ' },
  { id: 'c3', name: 'Charlie Brown', email: 'charlie@gmail.com', linkStatus: 'Linked', linkedTo: 'Sarah Lee', initials: 'CB' },
  { id: 'c4', name: 'David Lee', email: 'david.lee@tech.co', linkStatus: 'Unlinked', initials: 'DL' },
  { id: 'c5', name: 'Elena Woods', email: 'elena.w@studio.net', linkStatus: 'VIP', linkedTo: 'Mike Ross', initials: 'EW' }
]

const statusClassName = (status: LinkStatus) => {
  if (status === 'Linked') return styles.statusLinked
  if (status === 'VIP') return styles.statusVip
  return styles.statusUnlinked
}

export default function AdminCustomerList() {
  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <Text className={styles.title}>Customers</Text>
        <View className={styles.iconButton}>
          <Text className={styles.iconText}>Filter</Text>
        </View>
      </View>

      <View className={styles.searchWrap}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>Search</Text>
          <Input
            className={styles.searchInput}
            placeholder="Search by name or email..."
            placeholderClass={styles.searchPlaceholder}
          />
        </View>
      </View>

      <ScrollView scrollX className={styles.filterRow}>
        {['All', 'Unlinked', 'Linked', 'VIP'].map((label, index) => (
          <View key={label} className={index === 0 ? styles.filterChipActive : styles.filterChip}>
            <Text className={index === 0 ? styles.filterChipTextActive : styles.filterChipText}>{label}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView scrollY className={styles.list}>
        {customers.map((customer) => (
          <View key={customer.id} className={styles.listItem}>
            <View className={styles.avatar}>
              <Text className={styles.avatarText}>{customer.initials}</Text>
            </View>
            <View className={styles.listBody}>
              <Text className={styles.listName}>{customer.name}</Text>
              <Text className={styles.listEmail}>{customer.email}</Text>
              <View className={styles.linkRow}>
                <View className={`${styles.linkPill} ${statusClassName(customer.linkStatus)}`}>
                  <Text className={styles.linkText}>
                    {customer.linkStatus === 'Linked' && customer.linkedTo
                      ? `Linked to ${customer.linkedTo}`
                      : customer.linkStatus}
                  </Text>
                </View>
              </View>
            </View>
            <Text className={styles.chevron}>&gt;</Text>
          </View>
        ))}
        <View className={styles.listSpacer} />
      </ScrollView>

      <View className={styles.fab}>
        <Text className={styles.fabText}>+</Text>
      </View>
    </View>
  )
}
