import { View, Text, ScrollView } from '@tarojs/components'
import styles from './index.module.scss'

type CustomerStatus = 'Active' | 'Inactive'

const customer = {
  name: 'Jane Doe',
  status: 'Active' as CustomerStatus,
  id: '#839201',
  phone: '+1 (555) 123-4567',
  email: 'jane.doe@example.com',
  salesRep: 'John Smith',
  assignedAt: 'Assigned on Oct 24, 2023'
}

export default function AdminCustomerDetails() {
  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.iconButton}>
          <Text className={styles.iconText}>{'<'}</Text>
        </View>
        <Text className={styles.title}>Customer Details</Text>
        <View className={styles.iconButton}>
          <Text className={styles.iconAction}>Edit</Text>
        </View>
      </View>

      <ScrollView scrollY className={styles.scroll}>
        <View className={styles.profileSection}>
          <View className={styles.avatar}>
            <Text className={styles.avatarText}>JD</Text>
            <View className={styles.statusDot} />
          </View>
          <Text className={styles.profileName}>{customer.name}</Text>
          <View className={styles.profileBadges}>
            <View className={styles.badgeMuted}>
              <Text className={styles.badgeText}>ID: {customer.id}</Text>
            </View>
            <View className={styles.badgeActive}>
              <Text className={styles.badgeText}>{customer.status}</Text>
            </View>
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>Contact Information</Text>
          <View className={styles.card}>
            <View className={styles.infoRow}>
              <View className={styles.infoIcon}>
                <Text className={styles.infoIconText}>Call</Text>
              </View>
              <View className={styles.infoBody}>
                <Text className={styles.infoLabel}>Mobile</Text>
                <Text className={styles.infoValue}>{customer.phone}</Text>
              </View>
              <Text className={styles.chevron}>&gt;</Text>
            </View>
            <View className={styles.infoRow}>
              <View className={styles.infoIcon}>
                <Text className={styles.infoIconText}>Mail</Text>
              </View>
              <View className={styles.infoBody}>
                <Text className={styles.infoLabel}>Email</Text>
                <Text className={styles.infoValuePrimary}>{customer.email}</Text>
              </View>
              <Text className={styles.chevron}>&gt;</Text>
            </View>
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>Sales Relationship</Text>
          <View className={styles.card}>
            <View className={styles.salesRow}>
              <View className={styles.salesAvatar}>
                <Text className={styles.salesAvatarText}>JS</Text>
              </View>
              <View className={styles.salesBody}>
                <Text className={styles.infoLabel}>Managed By</Text>
                <Text className={styles.salesName}>{customer.salesRep}</Text>
              </View>
              <View className={styles.salesTag}>
                <Text className={styles.salesTagText}>SALES</Text>
              </View>
            </View>
            <View className={styles.cardFooter}>
              <Text className={styles.footerText}>{customer.assignedAt}</Text>
              <Text className={styles.footerLink}>History &gt;</Text>
            </View>
          </View>
        </View>

        <View className={styles.actionSection}>
          <View className={styles.primaryButton}>
            <Text className={styles.primaryButtonText}>Transfer Ownership</Text>
          </View>
          <Text className={styles.actionHint}>
            Generate a new binding QR code for the new salesperson.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
