import React, { useEffect, useState, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl, 
  Alert, 
  TextInput, 
  SafeAreaView, 
  Platform 
} from 'react-native';
import { 
  Package, 
  ChevronRight, 
  Clock, 
  Search, 
  RefreshCcw, 
  Filter, 
  Plus,
  User,
  Calendar,
  DollarSign
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../src/utils/supabase';

/**
 * Màn hình Danh sách Đơn hàng (app/(tabs)/orders.tsx)
 * Tích hợp phân quyền thông minh:
 * - Khách hàng: Chỉ thấy đơn hàng cá nhân.
 * - Quản lý (Manager): Thấy toàn bộ đơn hàng hệ thống trong 7 ngày gần nhất.
 */
export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Tải danh sách đơn hàng dựa trên Role
  const fetchOrders = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      const role = await AsyncStorage.getItem('userRole');
      
      setUserRole(role);
      if (!authData?.user) return;
      setCurrentUserId(authData.user.id);

      // Truy vấn cơ bản kết hợp thông tin chủ shop
      let query = supabase
        .from('tb_orders')
        .select(`
          *,
          tb_users:user_id (full_name, phone_number)
        `);

      if (role !== 'manager') {
        // KHÁCH HÀNG: Chỉ lọc đơn của chính mình
        query = query.eq('user_id', authData.user.id);
      } else {
        // QUẢN LÝ: Giới hạn hiển thị 7 ngày gần nhất để tối ưu hiệu năng
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Lỗi tải đơn hàng:', error.message);
      Alert.alert('Lỗi', 'Không thể làm mới danh sách đơn hàng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Hàm định dạng kiểu dáng theo trạng thái
  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return { label: 'Chờ xử lý', color: '#D97706', bg: '#FEF3C7' };
      case 'SHIPPING': return { label: 'Đang giao', color: '#2563EB', bg: '#DBEAFE' };
      case 'DELIVERED': return { label: 'Thành công', color: '#059669', bg: '#D1FAE5' };
      case 'CANCELLED': return { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
      default: return { label: 'Không xác định', color: '#4B5563', bg: '#F3F4F6' };
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const status = getStatusStyle(item.delivery_status);
    const isManager = userRole === 'manager';

    return (
      <TouchableOpacity 
        style={styles.orderCard}
        onPress={() => router.push(`/orders/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.orderIdContainer}>
            <Package color="#4F46E5" size={16} />
            <Text style={styles.orderIdText}>#{item.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusTag, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.customerName}>{item.receiver_name}</Text>
          <Text style={styles.addressText} numberOfLines={1}>{item.receiver_address_detail}</Text>
          
          {isManager && (
            <View style={styles.shopInfoBox}>
              <User size={12} color="#6B7280" />
              <Text style={styles.shopNameText}>Gửi từ: {item.tb_users?.full_name || 'N/A'}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.footerDetail}>
            <Clock size={12} color="#9CA3AF" />
            <Text style={styles.footerText}>
              {new Date(item.created_at).toLocaleDateString('vi-VN')}
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>COD:</Text>
            <Text style={styles.totalPriceText}>
              {Number(item.cod_amount).toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>
        
        <View style={styles.chevronContainer}>
          <ChevronRight size={18} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  // Logic lọc tìm kiếm theo ID đơn hoặc Tên khách hàng
  const filteredData = orders.filter(o => 
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.receiver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (userRole === 'manager' && o.tb_users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>
            {userRole === 'manager' ? 'HỆ THỐNG TỔNG' : 'ĐƠN HÀNG CỦA TÔI'}
          </Text>
          <Text style={styles.title}>
            {userRole === 'manager' ? 'Quản Lý Đơn Hàng' : 'Danh Sách Đơn'}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCcw size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Tìm kiếm & Lọc */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput 
            style={styles.searchInput}
            placeholder={userRole === 'manager' ? "Tìm theo ID, Khách hoặc Shop..." : "Tìm theo ID hoặc Tên khách..."}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Filter size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Danh sách đơn hàng */}
      <FlatList
        data={filteredData}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Package size={60} color="#E5E7EB" />
              <Text style={styles.emptyText}>Không tìm thấy đơn hàng nào trong 7 ngày qua.</Text>
            </View>
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loadingText}>Đang đồng bộ dữ liệu...</Text>
            </View>
          )
        }
      />

      {/* Nút thêm đơn chỉ cho Khách hàng */}
      {userRole !== 'manager' && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={() => router.push('/create-order' as any)}
        >
          <Plus size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#FFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6', 
    paddingTop: Platform.OS === 'ios' ? 10 : 25 
  },
  headerSubtitle: { fontSize: 10, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '900', color: '#111827', marginTop: 2 },
  refreshBtn: { padding: 10, backgroundColor: '#F3F4F6', borderRadius: 12 },
  
  searchSection: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF', alignItems: 'center' },
  searchBox: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    borderRadius: 14, 
    paddingHorizontal: 15, 
    height: 48 
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 14, color: '#1F2937', fontWeight: '500' },
  filterBtn: { marginLeft: 12, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 14 },
  
  listContainer: { padding: 16, paddingBottom: 100 },
  
  orderCard: { 
    backgroundColor: '#FFF', 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 14, 
    elevation: 3, 
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#F3F4F6'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderIdContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  orderIdText: { fontSize: 12, fontWeight: '800', color: '#4F46E5', marginLeft: 6 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  
  cardBody: { marginBottom: 12 },
  customerName: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  addressText: { fontSize: 13, color: '#6B7280', marginTop: 4, fontWeight: '500' },
  shopInfoBox: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#F9FAFB', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  shopNameText: { fontSize: 11, color: '#6B7280', marginLeft: 6, fontWeight: '700' },
  
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 8, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F9FAFB' 
  },
  footerDetail: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 12, color: '#9CA3AF', marginLeft: 6, fontWeight: '600' },
  priceContainer: { flexDirection: 'row', alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '800', marginRight: 4 },
  totalPriceText: { fontSize: 16, fontWeight: '900', color: '#059669' },
  
  chevronContainer: { position: 'absolute', right: 12, top: '50%', marginTop: -9 },
  
  empty: { alignItems: 'center', marginTop: 120 },
  emptyText: { marginTop: 15, color: '#9CA3AF', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40 },
  
  loadingBox: { alignItems: 'center', marginTop: 50 },
  loadingText: { marginTop: 10, color: '#4F46E5', fontWeight: '700' },
  
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 25, 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#4F46E5', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 8,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }
  }
});