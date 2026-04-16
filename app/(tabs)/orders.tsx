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
  Modal,
  ScrollView,
  Platform
} from 'react-native';
// Sử dụng thư viện chuẩn cho React Native
import { 
  Package, 
  ChevronRight, 
  Clock, 
  Trash2, 
  XCircle, 
  Search, 
  RefreshCcw, 
  CreditCard, 
  Truck, 
  Plus, 
  Filter, 
  X, 
  Calendar as CalendarIcon 
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/utils/supabase';

// Định nghĩa Interface
interface Order {
  id: string;
  created_at: string;
  receiver_name: string;
  cod_amount: number;
  shipping_fee: number;
  delivery_status: string;
  financial_status: string;
  is_receiver_pay: boolean; 
  pickup_address_id: string;
}

export default function App() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- States cho Bộ lọc ---
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [pickupAddresses, setPickupAddresses] = useState<any[]>([]);
  const [filterPickupId, setFilterPickupId] = useState<string | null>(null);
  const [filterDeliveryStatus, setFilterDeliveryStatus] = useState<string | null>(null);
  const [filterFinancialStatus, setFilterFinancialStatus] = useState<string | null>(null);
  
  // States cho DatePicker
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // 1. Tải danh sách kho lấy hàng ban đầu (để hiển thị trong filter)
  const fetchPickupAddresses = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data } = await supabase
          .from('tb_addresses')
          .select('id, contact_name')
          .eq('user_id', authData.user.id);
        if (data) setPickupAddresses(data);
      }
    } catch (error) { 
      console.error('Lỗi tải kho hàng:', error); 
    }
  };

  // 2. READ: Lấy danh sách đơn hàng kèm logic lọc nâng cao
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      
      if (authData?.user) {
        let query = supabase
          .from('tb_orders')
          .select('*')
          .eq('user_id', authData.user.id);

        // Lọc theo trạng thái giao hàng
        if (filterDeliveryStatus) {
          query = query.eq('delivery_status', filterDeliveryStatus);
        }
        
        // Lọc theo trạng thái thanh toán
        if (filterFinancialStatus) {
          query = query.eq('financial_status', filterFinancialStatus);
        }

        // Lọc theo kho lấy hàng
        if (filterPickupId) {
          query = query.eq('pickup_address_id', filterPickupId);
        }
        
        // Lọc theo khoảng thời gian (DatePicker)
        if (fromDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          query = query.gte('created_at', start.toISOString());
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          query = query.lte('created_at', end.toISOString());
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        setOrders(data || []);
      }
    } catch (error: any) {
      console.error('Lỗi tải đơn hàng:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterDeliveryStatus, filterFinancialStatus, filterPickupId, fromDate, toDate]);

  useEffect(() => {
    fetchOrders();
    fetchPickupAddresses();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const clearFilters = () => {
    setFilterPickupId(null);
    setFilterDeliveryStatus(null);
    setFilterFinancialStatus(null);
    setFromDate(null);
    setToDate(null);
    setFilterModalVisible(false);
  };

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return 'Chọn ngày';
    return date.toLocaleDateString('vi-VN');
  };

  // 3. DELETE: Xóa đơn hàng (Khắc phục lỗi FK Constraint)
  const handleDeleteOrder = (orderId: string) => {
    Alert.alert(
      'Xác nhận xóa',
      'Bạn có chắc chắn muốn xóa đơn hàng này vĩnh viễn không? Mọi lịch sử hành trình cũng sẽ bị xóa bỏ.',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xóa đơn', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Xóa các bản ghi liên quan trong bảng tracking trước
              await supabase.from('tb_order_tracking').delete().eq('order_id', orderId);
              
              const { error } = await supabase.from('tb_orders').delete().eq('id', orderId);
              if (error) throw error;
              
              setOrders(prev => prev.filter(o => o.id !== orderId));
              Alert.alert('Thành công', 'Đã xóa đơn hàng khỏi hệ thống.');
            } catch (error: any) {
              Alert.alert('Lỗi', 'Không thể xóa đơn: ' + error.message);
            }
          }
        }
      ]
    );
  };

  // 4. UPDATE: Hủy đơn hàng
  const handleCancelOrder = async (orderId: string) => {
    Alert.alert('Hủy đơn', 'Bạn muốn chuyển trạng thái đơn hàng này thành "Đã hủy"?', [
      { text: 'Không', style: 'cancel' },
      { text: 'Xác nhận', onPress: async () => {
          try {
            const { error } = await supabase.from('tb_orders').update({ delivery_status: 'CANCELLED' }).eq('id', orderId);
            if (error) throw error;
            
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, delivery_status: 'CANCELLED' } : o));
            
            const { data: authData } = await supabase.auth.getUser();
            await supabase.from('tb_order_tracking').insert([{
              order_id: orderId,
              status: 'CANCELLED',
              note: 'Hủy đơn hàng bởi người dùng.',
              updated_by: authData?.user?.id
            }]);
          } catch (e) {
            console.error(e);
          }
      }}
    ]);
  };

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return { label: 'Chờ xử lý', color: '#F59E0B', bg: '#FEF3C7' };
      case 'SHIPPING': return { label: 'Đang giao', color: '#3B82F6', bg: '#DBEAFE' };
      case 'DELIVERED': return { label: 'Thành công', color: '#10B981', bg: '#D1FAE5' };
      case 'CANCELLED': return { label: 'Đã hủy', color: '#EF4444', bg: '#FEE2E2' };
      default: return { label: status || 'Khác', color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const status = getStatusStyle(item.delivery_status);
    const isPending = item.delivery_status?.toUpperCase() === 'PENDING';
    const totalToCollect = item.is_receiver_pay 
      ? (Number(item.cod_amount) || 0) + (Number(item.shipping_fee) || 0)
      : (Number(item.cod_amount) || 0);

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity 
          style={styles.cardMain}
          onPress={() => router.push(`/orders/${item.id}` as any)}
        >
          <View style={styles.orderIconContainer}><Package color="#4F46E5" size={24} /></View>
          <View style={styles.orderContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderIdText} numberOfLines={1}>#{item.id.slice(0, 8)}</Text>
              <View style={[styles.statusTag, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <Text style={styles.customerName}>{item.receiver_name}</Text>
            <View style={styles.cardFooter}>
              <View style={styles.infoGroup}>
                <View style={styles.timeGroup}>
                  <Clock size={14} color="#9CA3AF" />
                  <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
                </View>
                <View style={styles.paymentMethodGroup}>
                  <CreditCard size={12} color={item.is_receiver_pay ? '#EF4444' : '#10B981'} />
                  <Text style={[styles.paymentMethodText, { color: item.is_receiver_pay ? '#EF4444' : '#10B981' }]}>
                    {item.is_receiver_pay ? 'KHÁCH TRẢ SHIP' : 'FREESHIP'}
                  </Text>
                </View>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.collectLabel}>Tổng thu:</Text>
                <Text style={styles.totalPriceText}>{totalToCollect.toLocaleString('vi-VN')}đ</Text>
              </View>
            </View>
          </View>
          <ChevronRight size={18} color="#D1D5DB" />
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => router.push(`/orders/tracking/${item.id}` as any)}
          >
            <Truck size={16} color="#4F46E5" />
            <Text style={[styles.actionBtnText, { color: '#4F46E5' }]}>Hành trình</Text>
          </TouchableOpacity>
          {isPending && (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleCancelOrder(item.id)}>
                <XCircle size={16} color="#EF4444" />
                <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Hủy đơn</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteOrder(item.id)}>
                <Trash2 size={16} color="#6B7280" />
                <Text style={styles.actionBtnText}>Xóa</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const filteredData = orders.filter(o => 
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    o.receiver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date, type?: 'from' | 'to') => {
    if (type === 'from') {
      setShowFromPicker(false);
      if (selectedDate) setFromDate(selectedDate);
    } else {
      setShowToPicker(false);
      if (selectedDate) setToDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý đơn hàng</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}><RefreshCcw size={20} color="#4F46E5" /></TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Tìm đơn hoặc khách hàng..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <TouchableOpacity 
          style={[styles.filterToggleBtn, (filterPickupId || filterDeliveryStatus || fromDate) && { backgroundColor: '#EEF2FF' }]} 
          onPress={() => setFilterModalVisible(true)}
        >
          <Filter size={20} color={(filterPickupId || filterDeliveryStatus || fromDate) ? '#4F46E5' : '#6B7280'} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 50 }} />
          ) : (
            <View style={styles.emptyView}>
              <Package size={60} color="#E5E7EB" />
              <Text style={styles.emptyStateText}>Không có đơn hàng nào phù hợp.</Text>
            </View>
          )
        }
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/create-order' as any)} 
        activeOpacity={0.8}
      >
        <Plus size={30} color="#ffffff" />
      </TouchableOpacity>

      {/* --- Filter Modal --- */}
      <Modal visible={filterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bộ lọc tìm kiếm</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}><X size={24} color="#333" /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterLabel}>Kho lấy hàng</Text>
              <View style={styles.chipContainer}>
                <TouchableOpacity 
                  style={[styles.chip, !filterPickupId && styles.chipActive]} 
                  onPress={() => setFilterPickupId(null)}
                >
                  <Text style={[styles.chipText, !filterPickupId && styles.chipTextActive]}>Tất cả</Text>
                </TouchableOpacity>
                {pickupAddresses.map(addr => (
                  <TouchableOpacity 
                    key={addr.id} 
                    style={[styles.chip, filterPickupId === addr.id && styles.chipActive]} 
                    onPress={() => setFilterPickupId(addr.id)}
                  >
                    <Text style={[styles.chipText, filterPickupId === addr.id && styles.chipTextActive]}>{addr.contact_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Trạng thái đơn hàng</Text>
              <View style={styles.chipContainer}>
                {['PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED'].map(st => (
                  <TouchableOpacity 
                    key={st} 
                    style={[styles.chip, filterDeliveryStatus === st && styles.chipActive]} 
                    onPress={() => setFilterDeliveryStatus(st === filterDeliveryStatus ? null : st)}
                  >
                    <Text style={[styles.chipText, filterDeliveryStatus === st && styles.chipTextActive]}>{getStatusStyle(st).label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Thời gian tạo đơn</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowFromPicker(true)}>
                  <Text style={styles.inputSubLabel}>Từ ngày</Text>
                  <View style={styles.dateDisplay}>
                    <CalendarIcon size={16} color="#4F46E5" style={{ marginRight: 8 }} />
                    <Text style={styles.dateTextValue}>{formatDateDisplay(fromDate)}</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowToPicker(true)}>
                  <Text style={styles.inputSubLabel}>Đến ngày</Text>
                  <View style={styles.dateDisplay}>
                    <CalendarIcon size={16} color="#4F46E5" style={{ marginRight: 8 }} />
                    <Text style={styles.dateTextValue}>{formatDateDisplay(toDate)}</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {showFromPicker && (
                <DateTimePicker
                  value={fromDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => onDateChange(e, d, 'from')}
                />
              )}
              {showToPicker && (
                <DateTimePicker
                  value={toDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => onDateChange(e, d, 'to')}
                />
              )}
              
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.resetBtn} onPress={clearFilters}><Text style={styles.resetBtnText}>Xóa lọc</Text></TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={() => { fetchOrders(); setFilterModalVisible(false); }}>
                  <Text style={styles.applyBtnText}>Áp dụng</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  iconBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  searchSection: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, height: 45 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#111827' },
  filterToggleBtn: { marginLeft: 12, padding: 10, backgroundColor: '#F3F4F6', borderRadius: 12 },
  listContainer: { padding: 16, paddingBottom: 100 },
  orderCard: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  orderIconContainer: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  orderContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderIdText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  statusLabel: { fontSize: 10, fontWeight: '800' },
  customerName: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  infoGroup: { flex: 1 },
  timeGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timeText: { fontSize: 12, color: '#9CA3AF', marginLeft: 4 },
  paymentMethodGroup: { flexDirection: 'row', alignItems: 'center' },
  paymentMethodText: { fontSize: 10, fontWeight: '800', marginLeft: 4 },
  priceContainer: { alignItems: 'flex-end' },
  collectLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  totalPriceText: { fontSize: 15, fontWeight: '800', color: '#111827' },
  quickActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FAFBFC', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionBtnText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
  emptyView: { marginTop: 60, alignItems: 'center' },
  emptyStateText: { color: '#9CA3AF', fontSize: 14, marginTop: 10 },
  fab: { position: 'absolute', bottom: 30, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff6b6b', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 4 } },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  filterLabel: { fontSize: 14, fontWeight: 'bold', color: '#4B5563', marginTop: 15, marginBottom: 10 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  chipText: { fontSize: 12, color: '#6B7280' },
  chipTextActive: { color: '#4F46E5', fontWeight: 'bold' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  datePickerBtn: { flex: 0.48 },
  inputSubLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 6 },
  dateDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  dateTextValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 20 },
  resetBtn: { flex: 0.35, padding: 12, alignItems: 'center' },
  resetBtnText: { color: '#EF4444', fontWeight: 'bold' },
  applyBtn: { flex: 0.6, backgroundColor: '#4F46E5', padding: 12, borderRadius: 12, alignItems: 'center' },
  applyBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});