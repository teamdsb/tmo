import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

const profile = {
  name: 'Alex Johnson',
  verified: true,
  email: 'alex.j@example.com',
  phone: '+1 (555) 123-4567',
  company: 'Acme Corp.',
  salesRep: 'Sarah Smith'
}

export default function CustomerProfile() {
  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.spacer} />
        <Text className={styles.title}>Profile</Text>
        <View className={styles.iconButton}>
          <Text className={styles.iconAction}>Edit</Text>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.profileHeader}>
          <View className={styles.avatar}>
            <Text className={styles.avatarText}>AJ</Text>
            <View className={styles.avatarBadge}>
              <Text className={styles.avatarBadgeText}>Edit</Text>
            </View>
          </View>
          <Text className={styles.profileName}>{profile.name}</Text>
          <View className={styles.profileVerify}>
            <Text className={styles.profileVerifyText}>Verified Customer</Text>
          </View>
        </View>

        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>My Sales Representative</Text>
          <Text className={styles.sectionAction}>Change</Text>
        </View>

        <View className={styles.salesCard}>
          <View className={styles.salesAvatar}>
            <Text className={styles.salesAvatarText}>SS</Text>
            <View className={styles.salesStatus} />
          </View>
          <View className={styles.salesBody}>
            <Text className={styles.salesName}>{profile.salesRep}</Text>
            <Text className={styles.salesRole}>Your Advisor</Text>
          </View>
          <View className={styles.salesActions}>
            <View className={styles.salesActionPrimary}>
              <Text className={styles.salesActionText}>Chat</Text>
            </View>
            <View className={styles.salesActionSecondary}>
              <Text className={styles.salesActionTextSecondary}>Call</Text>
            </View>
          </View>
        </View>

        <Text className={styles.sectionTitle}>Account Details</Text>
        <View className={styles.detailsCard}>
          <View className={styles.detailRow}>
            <Text className={styles.detailLabel}>Email Address</Text>
            <Text className={styles.detailValue}>{profile.email}</Text>
          </View>
          <View className={styles.detailRow}>
            <Text className={styles.detailLabel}>Phone Number</Text>
            <Text className={styles.detailValue}>{profile.phone}</Text>
          </View>
          <View className={styles.detailRow}>
            <Text className={styles.detailLabel}>Company</Text>
            <Text className={styles.detailValue}>{profile.company}</Text>
          </View>
        </View>

        <View className={styles.actionGroup}>
          <View className={styles.primaryButton}>
            <Text className={styles.primaryButtonText}>Scan New Agent</Text>
          </View>
          <View className={styles.secondaryButton}>
            <Text className={styles.secondaryButtonText}>Sign Out</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
