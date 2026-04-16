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
// SỬA LỖI: Sử dụng đúng thư viện icons dành cho React Native
import { 
  TrendingUp, 
  Package, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  ChevronRight,
  Calendar,
  RefreshCcw,
  BarChart2,
  Wallet,
  ArrowUpRight
} from 'lucide-react-native';
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

// Định nghĩa cấu trúc dữ liệu thống kê tích hợp tài chính 3 bước
interface DashboardStats {
  total: number;
  pending: number;
  shipping: number;
  delivered: number;
  cancelled: number;
  revenuePaid: number;      // Bước 3: Đã đối soát (Tiền thực tế nhận được)
  revenueCollected: number; // Bước 2: Đã thu hộ (Bưu tá cầm - chờ đối soát)
  revenueUnpaid: number;    // Bước 1: Chưa thu tiền (Đang giao hàng)
  last7Days: { label: string; count: number }[];
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    shipping: 0,
    delivered: 0,
    cancelled: 0,
    revenuePaid: 0,
    revenueCollected: 0,
    revenueUnpaid: 0,
    last7Days: []
  });

  // Hàm lấy dữ liệu thực tế từ Supabase và tính toán các chỉ số
  const fetchDashboardData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const userId = authData.user.id;

      // Truy vấn toàn bộ đơn hàng của người dùng hiện tại
      const { data: orders, error } = await supabase
        .from('tb_orders')
        .select('delivery_status, financial_status, cod_amount, created_at')
        .eq('user_id', userId);

      if (error) throw error;

      if (orders) {
        // Khởi tạo mảng 7 ngày gần nhất cho biểu đồ
        const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            dateStr: d.toISOString().split('T')[0],
            label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
            count: 0
          };
        });

        let revPaid = 0;      // paid
        let revCollected = 0; // collected
        let revUnpaid = 0;    // unpaid
        let counts = { PENDING: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 };

        orders.forEach(order => {
          const cod = Number(order.cod_amount) || 0;
          const fStatus = order.financial_status?.toLowerCase();

          // 1. Phân loại doanh thu theo 3 trạng thái tài chính
          if (fStatus === 'paid') {
            revPaid += cod;
          } else if (fStatus === 'collected') {
            revCollected += cod;
          } else {
            revUnpaid += cod;
          }

          // 2. Đếm số lượng theo trạng thái giao hàng
          const dStatus = order.delivery_status?.toUpperCase();
          if (dStatus in counts) {
            counts[dStatus as keyof typeof counts]++;
          }

          // 3. Phân bổ dữ liệu cho biểu đồ thanh
          const orderDate = order.created_at.split('T')[0];
          const dayMatch = last7DaysData.find(d => d.dateStr === orderDate);
          if (dayMatch) dayMatch.count++;
        });

        setStats({
          total: orders.length,
          pending: counts.PENDING,
          shipping: counts.SHIPPING,
          delivered: counts.DELIVERED,
          cancelled: counts.CANCELLED,
          revenuePaid: revPaid,
          revenueCollected: revCollected,
          revenueUnpaid: revUnpaid,
          last7Days: last7DaysData.map(d => ({ label: d.label, count: d.count }))
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
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.loadingText}>Đang cập nhật chỉ số...</Text>
      </View>
    );
  }

  const maxBarValue = Math.max(...stats.last7Days.map(d => d.count), 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Xin chào,</Text>
          <Text style={styles.headerTitle}>Tổng quan tài chính</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCcw size={20} color="#1D4ED8" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D4ED8']} />
        }
      >
        {/* KHỐI 1: TÀI CHÍNH 3 BƯỚC */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>DÒNG TIỀN COD</Text>
          
          {/* Thẻ chính: Đã đối soát */}
          <View style={styles.mainRevenueCard}>
            <View style={styles.revenueInfo}>
              <View style={styles.row}>
                <CheckCircle size={14} color="#BFDBFE" />
                <Text style={styles.revenueSubTitle}>ĐÃ ĐỐI SOÁT (TIỀN VỀ VÍ)</Text>
              </View>
              <Text style={styles.revenueValueMain}>{stats.revenuePaid.toLocaleString('vi-VN')}đ</Text>
            </View>
            <View style={styles.walletIconBg}>
              <Wallet size={48} color="rgba(255,255,255,0.2)" />
            </View>
          </View>

          {/* Thẻ phụ: Đã thu hộ & Chưa thu */}
          <View style={styles.secondaryStatsRow}>
            <View style={[styles.secondaryCard, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.secondaryLabel}>ĐÃ THU HỘ</Text>
              <Text style={styles.secondaryValue}>{stats.revenueCollected.toLocaleString('vi-VN')}đ</Text>
              <Text style={styles.secondaryNote}>Chờ đối soát</Text>
            </View>

            <View style={[styles.secondaryCard, { borderLeftColor: '#64748B' }]}>
              <Text style={styles.secondaryLabel}>CHƯA THU TIỀN</Text>
              <Text style={styles.secondaryValue}>{stats.revenueUnpaid.toLocaleString('vi-VN')}đ</Text>
              <Text style={styles.secondaryNote}>Đang đi giao</Text>
            </View>
          </View>
        </View>

        {/* KHỐI 2: TRẠNG THÁI VẬN HÀNH */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>VẬN HÀNH ĐƠN HÀNG</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusBox}>
              <Text style={[styles.statusValue, { color: '#1D4ED8' }]}>{stats.total}</Text>
              <Text style={styles.statusLabel}>TỔNG ĐƠN</Text>
            </View>
            <View style={styles.statusBox}>
              <Text style={[styles.statusValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
              <Text style={styles.statusLabel}>CHỜ XỬ LÝ</Text>
            </View>
            <View style={styles.statusBox}>
              <Text style={[styles.statusValue, { color: '#10B981' }]}>{stats.delivered}</Text>
              <Text style={styles.statusLabel}>THÀNH CÔNG</Text>
            </View>
            <View style={styles.statusBox}>
              <Text style={[styles.statusValue, { color: '#EF4444' }]}>{stats.cancelled}</Text>
              <Text style={styles.statusLabel}>ĐÃ HỦY</Text>
            </View>
          </View>
        </View>

        {/* KHỐI 3: BIỂU ĐỒ TĂNG TRƯỞNG */}
        <View style={styles.chartCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.chartTitle}>LƯỢNG ĐƠN 7 NGÀY QUA</Text>
            <BarChart2 size={16} color="#94A3B8" />
          </View>
          <View style={styles.barChartContainer}>
            {stats.last7Days.map((item, index) => (
              <View key={index} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View 
                    style={[
                      styles.barFill, 
                      { height: `${(item.count / maxBarValue) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.barDate}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* TRUY CẬP NHANH */}
        <TouchableOpacity style={styles.quickAccessItem}>
          <View style={styles.accessLeft}>
            <View style={styles.accessIconCircle}>
              <DollarSign size={20} color="#4F46E5" />
            </View>
            <Text style={styles.accessText}>Lịch sử đối soát chi tiết</Text>
          </View>
          <ChevronRight size={18} color="#CBD5E0" />
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 25,
    paddingBottom: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerGreeting: { fontSize: 11, color: '#94A3B8', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  refreshBtn: { padding: 10, backgroundColor: '#EFF6FF', borderRadius: 12 },
  
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  
  sectionContainer: { marginBottom: 28 },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', marginBottom: 12, marginLeft: 4, letterSpacing: 0.5 },

  mainRevenueCard: {
    backgroundColor: '#1D4ED8',
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 8,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  revenueInfo: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  revenueSubTitle: { color: '#BFDBFE', fontSize: 10, fontWeight: '800', marginLeft: 6, letterSpacing: 0.5 },
  revenueValueMain: { color: '#FFF', fontSize: 30, fontWeight: '900', marginTop: 8 },
  walletIconBg: { opacity: 0.8 },

  secondaryStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryCard: {
    width: (width - 44) / 2,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
  },
  secondaryLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.5 },
  secondaryValue: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginTop: 8 },
  secondaryNote: { fontSize: 9, fontWeight: '700', color: '#94A3B8', marginTop: 4 },

  statusGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statusBox: {
    width: (width - 64) / 4,
    backgroundColor: '#FFF',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusValue: { fontSize: 18, fontWeight: '900' },
  statusLabel: { fontSize: 7, fontWeight: '900', color: '#94A3B8', marginTop: 6 },

  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 11, fontWeight: '900', color: '#475569' },
  barChartContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    height: 120,
    marginTop: 24,
    paddingHorizontal: 4
  },
  barItem: { alignItems: 'center', flex: 1 },
  barTrack: { 
    width: 14, 
    height: 80, 
    backgroundColor: '#F1F5F9', 
    borderRadius: 7, 
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  barFill: { 
    width: '100%', 
    backgroundColor: '#3B82F6', 
    borderRadius: 7 
  },
  barDate: { fontSize: 9, color: '#94A3B8', marginTop: 12, fontWeight: '800' },

  quickAccessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  accessLeft: { flexDirection: 'row', alignItems: 'center' },
  accessIconCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  accessText: { fontSize: 14, fontWeight: '700', color: '#334155' }
});