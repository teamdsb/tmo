import { View, Text, Input, ScrollView } from '@tarojs/components'
import styles from './index.module.scss'

type SalespersonStatus = 'Active' | 'On Leave' | 'Inactive'

type SalespersonItem = {
  id: string
  name: string
  status: SalespersonStatus
  customerCount: number
  initials: string
}

const salespeople: SalespersonItem[] = [
  { id: '8821', name: 'John Doe', status: 'Active', customerCount: 45, initials: 'JD' },
  { id: '9920', name: 'Sarah Smith', status: 'On Leave', customerCount: 12, initials: 'SS' },
  { id: '1023', name: 'Michael Brown', status: 'Active', customerCount: 89, initials: 'MB' },
  { id: '4051', name: 'Emily Davis', status: 'Inactive', customerCount: 0, initials: 'ED' },
  { id: '5512', name: 'David Wilson', status: 'Active', customerCount: 21, initials: 'DW' }
]

const statusClassName = (status: SalespersonStatus) => {
  if (status === 'Active') return styles.statusActive
  if (status === 'On Leave') return styles.statusOnLeave
  return styles.statusInactive
}

export default function AdminSalespersonList() {
  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.iconButton}>
          <Text className={styles.iconText}>{'<'}</Text>
        </View>
        <Text className={styles.title}>Salespersons</Text>
        <View className={`${styles.iconButton} ${styles.iconButtonPrimary}`}>
          <Text className={styles.iconText}>Filter</Text>
        </View>
      </View>

      <View className={styles.searchWrap}>
        <View className={styles.searchBox}>
          <Text className={styles.searchIcon}>Search</Text>
          <Input
            className={styles.searchInput}
            placeholder="Search by name or ID..."
            placeholderClass={styles.searchPlaceholder}
          />
        </View>
      </View>

      <ScrollView scrollY className={styles.list}>
        <View className={styles.listHeader}>
          <Text className={styles.listHeaderLabel}>All Team Members</Text>
          <Text className={styles.listHeaderCount}>12 Total</Text>
        </View>

        {salespeople.map((person) => (
          <View key={person.id} className={styles.card}>
            <View className={styles.avatar}>
              <Text className={styles.avatarText}>{person.initials}</Text>
              <View className={styles.statusDot} />
            </View>
            <View className={styles.cardBody}>
              <View className={styles.cardTopRow}>
                <Text className={styles.cardName}>{person.name}</Text>
                <View className={`${styles.statusPill} ${statusClassName(person.status)}`}>
                  <Text className={styles.statusText}>{person.status}</Text>
                </View>
              </View>
              <Text className={styles.cardMeta}>ID: #{person.id} • {person.customerCount} Customers</Text>
            </View>
            <Text className={styles.chevron}>&gt;</Text>
          </View>
        ))}

        <View className={styles.listSpacer} />
      </ScrollView>

      <View className={styles.bottomBar}>
        <View className={styles.primaryButton}>
          <Text className={styles.primaryButtonText}>Add New Salesperson</Text>
        </View>
      </View>
    </View>
  )
}
