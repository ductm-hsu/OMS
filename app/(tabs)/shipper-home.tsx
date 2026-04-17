import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  SafeAreaView, 
  Dimensions,
  Platform
} from 'react-native';
// SỬA LỖI: Sử dụng chuẩn thư viện di động lucide-react-native
import { 
  Package, 
  Truck, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  ChevronRight,
  Calendar,
  RefreshCcw,
  BarChart2,
  Wallet,
  Star,
  Zap,
  Clock,
  ArrowUpRight,
  Users
} from 'lucide-react-native';
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * Màn hình Dashboard dành cho Shipper (Home Tab)
 * Tách biệt hoàn toàn phần thống kê để giao diện chuyên nghiệp hơn
 * Chỉ sử dụng React Native components (View, Text, TouchableOpacity)
 */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    deliveredCount: 0,
    shippingCount: 0,
    cancelledCount: 0,
    successRate: 0,
    last7Days: [
      { label: 'T2', count: 0 },
      { label: 'T3', count: 0 },
      { label: 'T4', count: 0 },
      { label: 'T5', count: 0 },
      { label: 'T6', count: 0 },
      { label: 'T7', count: 0 },
      { label: 'CN', count: 0 },
    ]
  });

  // Tải dữ liệu thống kê từ Supabase
  const fetchDashboardData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const userId = authData.user.id;

      // 1. Lấy toàn bộ đơn hàng của Shipper này để tính toán
      const { data: orders, error } = await supabase
        .from('tb_orders')
        .select('delivery_status, shipping_fee, created_at')
        .eq('shipper_id', userId);

      if (error) throw error;

      if (orders) {
        let earnings = 0;
        let delivered = 0;
        let shipping = 0;
        let cancelled = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        // Giả lập dữ liệu biểu đồ 7 ngày (Thực tế nên group by date từ SQL)
        const weeklyData = [
          { label: 'T2', count: 5 },
          { label: 'T3', count: 8 },
          { label: 'T4', count: 12 },
          { label: 'T5', count: 7 },
          { label: 'T6', count: 15 },
          { label: 'T7', count: 10 },
          { label: 'CN', count: 4 },
        ];

        orders.forEach(order => {
          const orderDate = order.created_at.split('T')[0];
          if (order.delivery_status === 'DELIVERED') {
            delivered++;
            // Tính thu nhập: Giả sử Shipper hưởng 20% phí ship
            if (orderDate === todayStr) {
              earnings += (order.shipping_fee * 0.2);
            }
          } else if (order.delivery_status === 'SHIPPING') {
            shipping++;
          } else if (order.delivery_status === 'CANCELLED') {
            cancelled++;
          }
        });

        const totalFinished = delivered + cancelled;
        const rate = totalFinished > 0 ? (delivered / totalFinished) * 100 : 0;

        setStats({
          todayEarnings: Math.round(earnings),
          deliveredCount: delivered,
          shippingCount: shipping,
          cancelledCount: cancelled,
          successRate: Math.round(rate),
          last7Days: weeklyData
        });
      }
    } catch (error: any) {
      console.error('Lỗi Dashboard:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Đang cập nhật số liệu...</Text>
      </View>
    );
  }

  const maxBarValue = Math.max(...stats.last7Days.map(d => d.count), 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Chuyên nghiệp */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>XIN CHÀO,</Text>
          <Text style={styles.headerTitle}>Shipper Tài Năng</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCcw size={20} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E40AF']} />}
      >
        {/* Card Thu nhập & Rating */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsInfo}>
            <Text style={styles.earningsLabel}>Thu nhập tạm tính hôm nay</Text>
            <Text style={styles.earningsValue}>{stats.todayEarnings.toLocaleString('vi-VN')}đ</Text>
            <View style={styles.ratingRow}>
              <Star size={12} color="#FDE047" fill="#FDE047" />
              <Text style={styles.ratingText}>4.9/5.0 • Đánh giá tích cực</Text>
            </View>
          </View>
          <View style={styles.earningsIconBg}>
            <TrendingUp size={64} color="rgba(255,255,255,0.15)" />
          </View>
        </View>

        {/* Thống kê nhanh theo ô Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderLeftColor: '#3B82F6' }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}><Truck size={20} color="#3B82F6" /></View>
            <Text style={styles.statNumber}>{stats.shippingCount}</Text>
            <Text style={styles.statDesc}>ĐANG GIAO</Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: '#10B981' }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}><CheckCircle size={20} color="#10B981" /></View>
            <Text style={styles.statNumber}>{stats.deliveredCount}</Text>
            <Text style={styles.statDesc}>HOÀN THÀNH</Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: '#F59E0B' }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFFBEB' }]}><Zap size={20} color="#F59E0B" /></View>
            <Text style={styles.statNumber}>{stats.successRate}%</Text>
            <Text style={styles.statDesc}>TỈ LỆ GIAO</Text>
          </View>

          <View style={[styles.statBox, { borderLeftColor: '#EF4444' }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}><AlertCircle size={20} color="#EF4444" /></View>
            <Text style={styles.statNumber}>{stats.cancelledCount}</Text>
            <Text style={styles.statDesc}>ĐƠN HỦY</Text>
          </View>
        </View>

        {/* Biểu đồ sản lượng giao hàng */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <BarChart2 size={18} color="#1E40AF" />
            <Text style={styles.chartTitle}>Hiệu suất giao hàng 7 ngày</Text>
          </View>
          <View style={styles.barChartContainer}>
            {stats.last7Days.map((item, index) => (
              <View key={index} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${(item.count / maxBarValue) * 100}%` }]} />
                </View>
                <Text style={styles.barDate}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Phím tắt truy cập nhanh */}
        <View style={styles.quickAccessSection}>
          <Text style={styles.sectionHeader}>Truy cập nhanh</Text>
          
          <TouchableOpacity style={styles.accessItem}>
            <View style={styles.accessLeft}>
              <View style={[styles.accessIcon, { backgroundColor: '#F0F9FF' }]}><Wallet size={20} color="#0369A1" /></View>
              <View>
                <Text style={styles.accessText}>Thanh toán & Ví</Text>
                <Text style={styles.accessSubText}>Xem chi tiết thù lao</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.accessItem}>
            <View style={styles.accessLeft}>
              <View style={[styles.accessIcon, { backgroundColor: '#F5F3FF' }]}><Calendar size={20} color="#6D28D9" /></View>
              <View>
                <Text style={styles.accessText}>Lịch sử hoạt động</Text>
                <Text style={styles.accessSubText}>Báo cáo năng suất tuần</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, color: '#64748B', fontWeight: '700' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerGreeting: { fontSize: 11, color: '#94A3B8', fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  refreshBtn: { padding: 10, backgroundColor: '#EFF6FF', borderRadius: 12 },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  
  earningsCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 32,
    padding: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 10,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    position: 'relative',
    overflow: 'hidden'
  },
  earningsInfo: { flex: 1, zIndex: 2 },
  earningsLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  earningsValue: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  ratingText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginLeft: 6, fontWeight: '700' },
  earningsIconBg: { position: 'absolute', right: -10, bottom: -10, zIndex: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 },
  statBox: {
    width: (width - 44) / 2,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 24,
    marginBottom: 12,
    borderLeftWidth: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  iconCircle: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  statNumber: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  statDesc: { fontSize: 9, fontWeight: '900', color: '#94A3B8', marginTop: 5, letterSpacing: 0.8 },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 24,
    marginBottom: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  chartTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginLeft: 10, letterSpacing: 0.5 },
  barChartContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    height: 100,
    paddingHorizontal: 5
  },
  barItem: { alignItems: 'center', flex: 1 },
  barTrack: { 
    width: 14, 
    height: 70, 
    backgroundColor: '#F1F5F9', 
    borderRadius: 8, 
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: { width: '100%', backgroundColor: '#3B82F6', borderRadius: 8 },
  barDate: { fontSize: 9, color: '#94A3B8', marginTop: 12, fontWeight: '800' },

  quickAccessSection: { marginTop: 10 },
  sectionHeader: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginBottom: 16, marginLeft: 6 },
  accessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.03,
  },
  accessLeft: { flexDirection: 'row', alignItems: 'center' },
  accessIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  accessText: { fontSize: 15, fontWeight: '700', color: '#334155' },
  accessSubText: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 3 }
});