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
// Đảm bảo sử dụng lucide-react-native cho môi trường di động
import { 
  TrendingUp, 
  Package, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  DollarSign,
  ChevronRight,
  BarChart2,
  Wallet,
  RefreshCcw
} from 'lucide-react-native';
import { supabase } from '../../src/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Định nghĩa cấu trúc dữ liệu thống kê chuyên sâu
interface DashboardStats {
  total: number;
  pending: number;
  shipping: number;
  delivered: number;
  cancelled: number;
  revenuePaid: number;      // Đã đối soát (Tiền đã về ví chủ shop)
  revenueCollected: number; // Đã thu hộ (Shipper đang cầm - chờ đối soát)
  revenueUnpaid: number;    // Chưa thu tiền (Đơn đang đi giao)
  last7Days: { label: string; count: number }[];
}

/**
 * Màn hình Thống kê (Home Tab)
 * Tự động phân quyền:
 * - Manager: Xem số liệu toàn bộ hệ thống (Global)
 * - Khách hàng: Xem số liệu đơn hàng cá nhân
 */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
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

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      // 1. Lấy thông tin người dùng và vai trò từ bộ nhớ
      const { data: authData } = await supabase.auth.getUser();
      const role = await AsyncStorage.getItem('userRole');
      setUserRole(role);

      if (!authData?.user) return;
      const userId = authData.user.id;

      // 2. Truy vấn dữ liệu từ Supabase
      // Nếu là manager: Không lọc theo user_id (Xem toàn sàn)
      let query = supabase
        .from('tb_orders')
        .select('delivery_status, financial_status, cod_amount, created_at');

      if (role !== 'manager') {
        query = query.eq('user_id', userId);
      }

      const { data: orders, error } = await query;
      if (error) throw error;

      if (orders) {
        // Khởi tạo khung dữ liệu 7 ngày gần nhất cho biểu đồ
        const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            dateStr: d.toISOString().split('T')[0],
            label: `${d.getDate()}/${d.getMonth() + 1}`,
            count: 0
          };
        });

        let revPaid = 0;      
        let revCollected = 0; 
        let revUnpaid = 0;    
        let counts = { PENDING: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 };

        orders.forEach(order => {
          const cod = Number(order.cod_amount) || 0;
          const fStatus = order.financial_status?.toLowerCase();

          // Phân loại dòng tiền theo trạng thái tài chính
          if (fStatus === 'paid') {
            revPaid += cod;
          } else if (fStatus === 'collected') {
            revCollected += cod;
          } else {
            revUnpaid += cod;
          }

          // Phân loại đơn hàng theo trạng thái vận hành
          const dStatus = order.delivery_status?.toUpperCase();
          if (dStatus in counts) {
            counts[dStatus as keyof typeof counts]++;
          }

          // Thống kê lượng đơn theo ngày
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
      console.error('Dashboard Error:', error.message);
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
        <Text style={styles.loadingText}>Đang tổng hợp dữ liệu {userRole === 'manager' ? 'toàn sàn' : ''}...</Text>
      </View>
    );
  }

  const maxBarValue = Math.max(...stats.last7Days.map(d => d.count), 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Chào mừng */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>XIN CHÀO,</Text>
          <Text style={styles.headerTitle}>
            {userRole === 'manager' ? 'Tổng quan hệ thống' : 'Thống kê của tôi'}
          </Text>
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
        {/* KHỐI 1: DÒNG TIỀN COD (3 TRẠNG THÁI) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DÒNG TIỀN COD</Text>
          
          {/* Tiền đã về ví (Đối soát xong) */}
          <View style={styles.mainRevenueCard}>
            <View style={styles.revenueInfo}>
              <View style={styles.row}>
                <CheckCircle size={14} color="#BFDBFE" />
                <Text style={styles.revenueSubTitle}>ĐÃ ĐỐI SOÁT (TIỀN VỀ VÍ)</Text>
              </View>
              <Text style={styles.revenueValueMain}>{stats.revenuePaid.toLocaleString('vi-VN')}đ</Text>
            </View>
            <Wallet size={48} color="rgba(255,255,255,0.2)" />
          </View>

          {/* Tiền đang lưu động */}
          <View style={styles.secondaryStatsRow}>
            <View style={[styles.secondaryCard, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.secondaryLabel}>ĐÃ THU HỘ</Text>
              <Text style={styles.secondaryValue}>{stats.revenueCollected.toLocaleString('vi-VN')}đ</Text>
              <Text style={styles.secondaryNote}>Chờ Manager đối soát</Text>
            </View>

            <View style={[styles.secondaryCard, { borderLeftColor: '#64748B' }]}>
              <Text style={styles.secondaryLabel}>CHƯA THU TIỀN</Text>
              <Text style={styles.secondaryValue}>{stats.revenueUnpaid.toLocaleString('vi-VN')}đ</Text>
              <Text style={styles.secondaryNote}>Đơn đang vận chuyển</Text>
            </View>
          </View>
        </View>

        {/* KHỐI 2: TRẠNG THÁI VẬN HÀNH */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VẬN HÀNH ĐƠN HÀNG</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusBox}>
              <Text style={[styles.statusValue, { color: '#1E40AF' }]}>{stats.total}</Text>
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

        {/* KHỐI 3: BIỂU ĐỒ 7 NGÀY QUA */}
        <View style={styles.chartCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.chartTitle}>LƯỢNG ĐƠN 7 NGÀY QUA</Text>
            <BarChart2 size={16} color="#94A3B8" />
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

        {/* PHẦN LỊCH SỬ CHI TIẾT */}
        <TouchableOpacity style={styles.quickAccess} activeOpacity={0.7}>
          <View style={styles.accessLeft}>
            <View style={styles.accessIcon}><DollarSign size={20} color="#1E40AF" /></View>
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
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '700' },
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
  headerGreeting: { fontSize: 10, color: '#94A3B8', fontWeight: '900', letterSpacing: 1.5 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  refreshBtn: { padding: 10, backgroundColor: '#EFF6FF', borderRadius: 12 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#64748B', marginBottom: 14, marginLeft: 4, letterSpacing: 1 },
  mainRevenueCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 8,
    shadowColor: '#1E40AF',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 }
  },
  revenueInfo: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  revenueSubTitle: { color: '#BFDBFE', fontSize: 10, fontWeight: '800', marginLeft: 6 },
  revenueValueMain: { color: '#FFF', fontSize: 32, fontWeight: '900', marginTop: 10 },
  secondaryStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryCard: {
    width: (width - 44) / 2,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 22,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.03
  },
  secondaryLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8' },
  secondaryValue: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginTop: 8 },
  secondaryNote: { fontSize: 9, fontWeight: '700', color: '#94A3B8', marginTop: 4 },
  statusGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statusBox: {
    width: (width - 64) / 4,
    backgroundColor: '#FFF',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusValue: { fontSize: 18, fontWeight: '900' },
  statusLabel: { fontSize: 7, fontWeight: '900', color: '#94A3B8', marginTop: 6 },
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 10, fontWeight: '900', color: '#475569', letterSpacing: 0.5 },
  barChartContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    height: 100,
    marginTop: 25,
    paddingHorizontal: 5
  },
  barItem: { alignItems: 'center', flex: 1 },
  barTrack: { width: 14, height: 70, backgroundColor: '#F1F5F9', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#3B82F6', borderRadius: 7 },
  barDate: { fontSize: 8, color: '#94A3B8', marginTop: 12, fontWeight: '800' },
  quickAccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  accessLeft: { flexDirection: 'row', alignItems: 'center' },
  accessIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  accessText: { fontSize: 14, fontWeight: '700', color: '#334155' }
});