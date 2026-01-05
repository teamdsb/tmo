import { View, Text, ScrollView } from '@tarojs/components'
import styles from './index.module.scss'

type CustomerStatus = 'Active' | 'Inactive'

type Customer = {
  id: string
  name: string
  boundAt: string
  status: CustomerStatus
  initials: string
}

const customers: Customer[] = [
  { id: 'acme', name: 'Acme Corp', boundAt: 'Oct 12, 2023', status: 'Active', initials: 'AC' },
  { id: 'john', name: 'John Doe', boundAt: 'Oct 10, 2023', status: 'Active', initials: 'JD' },
  { id: 'jane', name: 'Jane Smith', boundAt: 'Sept 28, 2023', status: 'Inactive', initials: 'JS' },
  { id: 'tech', name: 'Tech Enterprises', boundAt: 'Sept 15, 2023', status: 'Active', initials: 'TE' }
]

export default function AdminSalespersonDetails() {
  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.iconButton}>
          <Text className={styles.iconText}>{'<'}</Text>
        </View>
        <Text className={styles.title}>Salesperson Details</Text>
        <View className={styles.iconButton}>
          <Text className={styles.iconAction}>Edit</Text>
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.profileCard}>
          <View className={styles.profileAvatar}>
            <Text className={styles.profileInitials}>SJ</Text>
            <View className={styles.profileStatus} />
          </View>
          <Text className={styles.profileName}>Sarah Jenkins</Text>
          <Text className={styles.profileTitle}>Senior Sales Representative</Text>
          <View className={styles.profileBadge}>
            <Text className={styles.profileBadgeText}>Verified Employee</Text>
          </View>
        </View>

        <View className={styles.statsRow}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>42</Text>
            <Text className={styles.statLabel}>Total Customers</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>18</Text>
            <Text className={styles.statLabel}>Active This Month</Text>
          </View>
        </View>

        <View className={styles.bindCard}>
          <View className={styles.bindInfo}>
            <Text className={styles.bindLabel}>Current Bind Code</Text>
            <Text className={styles.bindCode}>SJ-8821</Text>
            <Text className={styles.bindHint}>Tap QR to enlarge</Text>
            <View className={styles.bindButton}>
              <Text className={styles.bindButtonText}>Regenerate</Text>
            </View>
          </View>
          <View className={styles.qrBox}>
            <Text className={styles.qrText}>QR</Text>
          </View>
        </View>

        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>Associated Customers</Text>
          <Text className={styles.sectionLink}>See all</Text>
        </View>

        <View className={styles.customerList}>
          {customers.map((customer) => (
            <View key={customer.id} className={styles.customerCard}>
              <View className={styles.customerAvatar}>
                <Text className={styles.customerInitials}>{customer.initials}</Text>
              </View>
              <View className={styles.customerBody}>
                <Text className={styles.customerName}>{customer.name}</Text>
                <Text className={styles.customerMeta}>Bound: {customer.boundAt}</Text>
              </View>
              <View className={customer.status === 'Active' ? styles.customerStatusActive : styles.customerStatusInactive}>
                <Text className={styles.customerStatusText}>{customer.status}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className={styles.scrollSpacer} />
      </ScrollView>
    </View>
  )
}
