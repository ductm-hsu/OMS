import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Platform,
  Modal,
  Dimensions
} from 'react-native';
// Sử dụng SafeAreaView từ thư viện context để tối ưu hiển thị
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// Thư viện Icon chuẩn cho Expo/React Native
import { 
  Package, 
  ChevronRight, 
  Clock, 
  Search, 
  RefreshCcw, 
  Filter, 
  Plus,
  User,
  X,
  CheckCircle2,
  Trash2,
  Ban,
  MapPin, // Icon thay thế cho Navigation để mô tả hành trình
  ArrowRight
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Đảm bảo tệp supabase.ts/js tồn tại trong thư mục utils
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * MÀN HÌNH QUẢN LÝ ĐƠN HÀNG (Customer/Manager)
 * - Hiển thị danh sách đơn hàng.
 * - Bổ sung nút "Hành trình" để truy cập chi tiết từ tb_order_tracking.
 */
export default function App() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const STATUS_OPTIONS = [
    { label: 'Tất cả trạng thái', value: 'ALL', color: '#64748B' },
    { label: 'Chờ lấy hàng', value: 'PENDING', color: '#D97706' },
    { label: 'Đang giao hàng', value: 'SHIPPING', color: '#2563EB' },
    { label: 'Giao thành công', value: 'DELIVERED', color: '#059669' },
    { label: 'Đã hủy đơn', value: 'CANCELLED', color: '#DC2626' },
  ];

  // 1. Tải danh sách đơn hàng từ Database
  const fetchOrders = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      const role = await AsyncStorage.getItem('userRole');
      setUserRole(role);

      if (!authData?.user) return;
      setCurrentUserId(authData.user.id);

      let query = supabase
        .from('tb_orders')
        .select(`
          *,
          shop:user_id (full_name)
        `);

      // Phân quyền: Manager thấy hết, Customer thấy đơn của mình
      if (role !== 'manager') {
        query = query.eq('user_id', authData.user.id);
      } else {
        // Manager chỉ xem đơn trong 7 ngày gần nhất để tối ưu hiệu năng
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Lỗi tải dữ liệu:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 2. Logic lọc và tìm kiếm dữ liệu
  const filteredData = useMemo(() => {
    return orders.filter(item => {
      const matchesStatus = statusFilter === 'ALL' || item.delivery_status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        item.id.toLowerCase().includes(query) ||
        item.receiver_name?.toLowerCase().includes(query) ||
        (userRole === 'manager' && item.shop?.full_name?.toLowerCase().includes(query));

      return matchesStatus && matchesSearch;
    });
  }, [orders, searchQuery, statusFilter, userRole]);

  // 3. Xử lý trạng thái và màu sắc
  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return { label: 'Chờ lấy', color: '#D97706', bg: '#FEF3C7' };
      case 'SHIPPING': return { label: 'Đang giao', color: '#2563EB', bg: '#DBEAFE' };
      case 'DELIVERED': return { label: 'Thành công', color: '#059669', bg: '#D1FAE5' };
      case 'CANCELLED': return { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
      default: return { label: 'N/A', color: '#4B5563', bg: '#F3F4F6' };
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const statusInfo = getStatusStyle(item.delivery_status);
    const isPending = item.delivery_status === 'PENDING';
    const isCancelled = item.delivery_status === 'CANCELLED';
    const isCustomer = userRole !== 'manager';

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity 
          onPress={() => router.push(`/orders/${item.id}` as any)} 
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.orderIdBox}>
              <Package color="#4F46E5" size={14} />
              <Text style={styles.orderIdText}>#{item.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          </View>
          
          <View style={styles.cardBody}>
            <Text style={styles.customerName}>{item.receiver_name}</Text>
            <Text style={styles.addressText} numberOfLines={1}>{item.receiver_address_detail}</Text>
            {userRole === 'manager' && (
              <View style={styles.shopBadge}>
                <User size={10} color="#64748B" />
                <Text style={styles.shopNameText}>Shop: {item.shop?.full_name || 'N/A'}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.cardFooter}>
            <View style={styles.timeGroup}>
              <Clock size={12} color="#94A3B8" />
              <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
            </View>
            <View style={styles.priceGroup}>
              <Text style={styles.priceLabel}>Thu hộ:</Text>
              <Text style={styles.priceValue}>{Number(item.cod_amount).toLocaleString('vi-VN')}đ</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* CÁC NÚT THAO TÁC NHANH */}
        <View style={styles.actionRow}>
          {/* NÚT HÀNH TRÌNH: Xem tracking từ tb_order_tracking */}
          <TouchableOpacity 
            style={[styles.actionBtn, styles.trackingBtn]} 
            onPress={() => router.push(`/orders/tracking/${item.id}` as any)}
          >
            <MapPin size={14} color="#4F46E5" />
            <Text style={[styles.actionBtnText, { color: '#4F46E5' }]}>Hành trình</Text>
          </TouchableOpacity>

          {isCustomer && isPending && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.cancelBtn]} 
              onPress={() => {
                Alert.alert('Xác nhận', 'Bạn muốn hủy đơn hàng này?', [
                  { text: 'Quay lại', style: 'cancel' },
                  { text: 'Đồng ý', onPress: async () => {
                      // Logic hủy đơn tại đây
                  }}
                ]);
              }}
            >
              <Ban size={14} color="#D97706" />
              <Text style={[styles.actionBtnText, { color: '#D97706' }]}>Hủy đơn</Text>
            </TouchableOpacity>
          )}

          {isCustomer && (isPending || isCancelled) && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.deleteBtn]} 
              onPress={() => {
                 // Logic xóa đơn tại đây
              }}
            >
              <Trash2 size={14} color="#DC2626" />
              <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Xóa</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubText}>{userRole === 'manager' ? 'HỆ THỐNG QUẢN TRỊ' : 'QUẢN LÝ ĐƠN HÀNG'}</Text>
          <Text style={styles.headerTitle}>Đơn Hàng Của Tôi</Text>
        </View>
        <TouchableOpacity onPress={() => fetchOrders()} style={styles.refreshBtn}>
          <RefreshCcw size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Tìm kiếm & Lọc */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#94A3B8" />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Tìm theo mã đơn, người nhận..." 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            placeholderTextColor="#94A3B8"
          />
        </View>
        <TouchableOpacity 
          style={[styles.filterBtn, statusFilter !== 'ALL' && styles.filterBtnActive]} 
          onPress={() => setFilterModalVisible(true)}
        >
          <Filter size={20} color={statusFilter !== 'ALL' ? '#fff' : '#64748B'} />
        </TouchableOpacity>
      </View>

      {/* Danh sách */}
      <FlatList
        data={filteredData}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders()} colors={['#4F46E5']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Package size={64} color="#E2E8F0" />
            <Text style={styles.emptyText}>Chưa có đơn hàng nào phù hợp.</Text>
          </View>
        ) : <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />}
      />

      {/* Modal Lọc */}
      <Modal visible={isFilterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc trạng thái</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}><X size={24} color="#64748B" /></TouchableOpacity>
            </View>
            {STATUS_OPTIONS.map((option) => (
              <TouchableOpacity 
                key={option.value} 
                style={[
                  styles.filterOption, 
                  statusFilter === option.value && { borderColor: option.color, backgroundColor: option.color + '10' }
                ]} 
                onPress={() => { setStatusFilter(option.value); setFilterModalVisible(false); }}
              >
                <Text style={[styles.filterOptionText, statusFilter === option.value && { color: option.color }]}>{option.label}</Text>
                {statusFilter === option.value && <CheckCircle2 size={16} color={option.color} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* FAB: Tạo đơn mới */}
      {userRole !== 'manager' && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/orders/create' as any)}>
          <Plus size={30} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  headerSubText: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#111827', marginTop: 2 },
  refreshBtn: { padding: 10, backgroundColor: '#F1F5F9', borderRadius: 12 },
  
  searchSection: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' },
  searchContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    paddingHorizontal: 15, 
    height: 52, 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '500', color: '#1E293B' },
  filterBtn: { 
    width: 52, 
    height: 52, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  filterBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  
  listPadding: { padding: 16, paddingBottom: 100 },
  orderCard: { 
    backgroundColor: '#fff', 
    borderRadius: 22, 
    padding: 16, 
    marginBottom: 14, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 4 } 
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderIdBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#EEF2FF', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8 
  },
  orderIdText: { fontSize: 12, fontWeight: '800', color: '#4F46E5', marginLeft: 6 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  
  cardBody: { marginBottom: 12 },
  customerName: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  addressText: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '500' },
  shopBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8, 
    backgroundColor: '#F8FAFC', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#F1F5F9' 
  },
  shopNameText: { fontSize: 11, color: '#64748B', marginLeft: 6, fontWeight: '700' },
  
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F8FAFC' 
  },
  timeGroup: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 12, color: '#94A3B8', marginLeft: 6, fontWeight: '600' },
  priceGroup: { flexDirection: 'row', alignItems: 'center' },
  priceLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '800', marginRight: 4 },
  priceValue: { fontSize: 16, fontWeight: '900', color: '#059669' },
  
  actionRow: { 
    flexDirection: 'row', 
    marginTop: 15, 
    paddingTop: 15, 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9', 
    gap: 10 
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    borderRadius: 10, 
    borderWidth: 1 
  },
  actionBtnText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  trackingBtn: { borderColor: '#E0E7FF', backgroundColor: '#F5F7FF' },
  cancelBtn: { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' },
  deleteBtn: { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { marginTop: 15, color: '#94A3B8', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  
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
    elevation: 8 
  },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  filterOption: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#F1F5F9', 
    marginBottom: 10 
  },
  filterOptionText: { fontSize: 15, fontWeight: '700', color: '#475569' }
});