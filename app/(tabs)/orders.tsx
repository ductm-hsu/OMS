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
  Modal, 
  Dimensions, 
  ScrollView, 
  Platform 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Package, 
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
  MapPin, 
  Calendar, 
  Warehouse, 
  History, 
  ChevronRight, 
  Truck, 
  Bell 
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '../../src/utils/supabase';

const { width, height } = Dimensions.get('window');

/**
 * MÀN HÌNH QUẢN LÝ ĐƠN HÀNG (OMS)
 * - Thiết kế theo image_956615.png (Premium Mobile Style)
 * - Đầy đủ nút: Hành trình, Hủy đơn, Xóa đơn
 * - Bộ lọc nâng cao: Ngày tháng (Native Picker), Kho hàng, Trạng thái.
 */
export default function App() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  
  // --- States cho Bộ lọc Nâng cao ---
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [addressFilter, setAddressFilter] = useState<string>('ALL');
  
  // Lưu trữ ngày dưới dạng đối tượng Date
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  
  // Điều khiển hiển thị Picker (cho Android)
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const STATUS_OPTIONS = [
    { label: 'Tất cả trạng thái', value: 'ALL', color: '#64748B' },
    { label: 'Chờ lấy hàng', value: 'PENDING', color: '#D97706' },
    { label: 'Đang giao hàng', value: 'SHIPPING', color: '#2563EB' },
    { label: 'Giao thành công', value: 'DELIVERED', color: '#059669' },
    { label: 'Đã hủy đơn', value: 'CANCELLED', color: '#DC2626' },
  ];

  // 1. Tải danh sách đơn hàng và danh sách kho
  const fetchData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const role = await AsyncStorage.getItem('userRole');
      setUserRole(role);

      if (!authData?.user) return;

      // Tải danh sách kho để hiển thị trong bộ lọc
      const { data: addrData } = await supabase
        .from('tb_addresses')
        .select('id, contact_name')
        .eq('user_id', authData.user.id);
      setAddresses(addrData || []);

      // Tải đơn hàng
      let query = supabase
        .from('tb_orders')
        .select(`
          *,
          shop:user_id (full_name),
          pickup:pickup_address_id (contact_name)
        `);

      if (role !== 'manager') {
        query = query.eq('user_id', authData.user.id);
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
    fetchData();
  }, [fetchData]);

  // 2. Logic lọc dữ liệu (Client-side)
  const filteredData = useMemo(() => {
    return orders.filter(item => {
      // Lọc theo tìm kiếm
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        item.id.toLowerCase().includes(query) || 
        item.receiver_name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      // Lọc theo trạng thái
      if (statusFilter !== 'ALL' && item.delivery_status !== statusFilter) return false;
      
      // Lọc theo kho hàng
      if (addressFilter !== 'ALL' && item.pickup_address_id !== addressFilter) return false;

      // Lọc theo ngày (Created_at)
      const orderDate = new Date(item.created_at).setHours(0,0,0,0);
      if (startDate) {
        const startLimit = new Date(startDate).setHours(0,0,0,0);
        if (orderDate < startLimit) return false;
      }
      if (endDate) {
        const endLimit = new Date(endDate).setHours(23,59,59,999);
        if (orderDate > endLimit) return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, addressFilter, startDate, endDate]);

  const resetFilters = () => {
    setStatusFilter('ALL');
    setAddressFilter('ALL');
    setStartDate(null);
    setEndDate(null);
  };

  const hasActiveFilters = statusFilter !== 'ALL' || addressFilter !== 'ALL' || startDate !== null || endDate !== null;

  // 3. Xử lý DateTimePicker
  const onStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios'); // iOS giữ picker mở
    if (selectedDate) setStartDate(selectedDate);
    if (Platform.OS === 'android') setShowStartPicker(false);
  };

  const onEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setEndDate(selectedDate);
    if (Platform.OS === 'android') setShowEndPicker(false);
  };

  const formatDateLabel = (date: Date | null) => {
    if (!date) return 'Chọn ngày';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusDisplay = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CANCELLED': 
        return { label: 'Đơn hàng bị hủy', color: '#DC2626', bg: '#FEE2E2', icon: <Ban size={22} color="#DC2626" /> };
      case 'DELIVERED': 
        return { label: 'Giao hàng thành công', color: '#059669', bg: '#D1FAE5', icon: <CheckCircle2 size={22} color="#059669" /> };
      case 'SHIPPING': 
        return { label: 'Đang giao hàng', color: '#2563EB', bg: '#DBEAFE', icon: <Truck size={22} color="#2563EB" /> };
      default: 
        return { label: 'Chờ lấy hàng', color: '#D97706', bg: '#FEF3C7', icon: <Package size={22} color="#D97706" /> };
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const display = getStatusDisplay(item.delivery_status);
    const isPending = item.delivery_status === 'PENDING';
    const isCancelled = item.delivery_status === 'CANCELLED';
    const isCustomer = userRole !== 'manager';

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity 
          style={styles.cardMainContent} 
          activeOpacity={0.7}
          onPress={() => router.push(`/orders/${item.id}` as any)}
        >
          {/* Icon box bên trái theo mẫu Premium */}
          <View style={[styles.statusIconBox, { backgroundColor: display.bg }]}>
            {display.icon}
          </View>

          {/* Nội dung chi tiết */}
          <View style={styles.orderInfo}>
            <Text style={styles.statusTitle}>{display.label}</Text>
            <Text style={styles.orderDetailText} numberOfLines={1}>
              Đơn #{item.id.slice(0,8).toUpperCase()}: {item.order_contents || `Giao đến ${item.receiver_name}`}
            </Text>
            
            <View style={styles.metaRow}>
              <View style={styles.timeBox}>
                <Clock size={12} color="#94A3B8" />
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(item.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </Text>
              </View>
              <View style={styles.idTag}>
                <Text style={styles.idTagText}>#{item.id.slice(0, 8).toUpperCase()}</Text>
              </View>
            </View>
          </View>

          <ChevronRight size={18} color="#E2E8F0" />
        </TouchableOpacity>

        {/* NÚT THAO TÁC NHANH (Hành trình, Hủy, Xóa) */}
        <View style={styles.actionRow}>
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
              onPress={() => Alert.alert('Xác nhận', 'Bạn muốn hủy đơn hàng này?')}
            >
              <Ban size={14} color="#D97706" />
              <Text style={[styles.actionBtnText, { color: '#D97706' }]}>Hủy đơn</Text>
            </TouchableOpacity>
          )}

          {isCustomer && (isPending || isCancelled) && (
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]}>
              <Trash2 size={14} color="#DC2626" />
              <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Xóa</Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.priceGroup}>
             <Text style={styles.priceValue}>{Number(item.cod_amount).toLocaleString()}đ</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Đơn Gửi</Text>
          <Text style={styles.headerSub}>Tin tức và hành trình đơn hàng</Text>
        </View>
        <TouchableOpacity onPress={() => fetchData()} style={styles.refreshBtn}>
          <RefreshCcw size={22} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Tìm kiếm & Nút mở Bộ lọc */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#94A3B8" />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Tìm theo mã đơn, người nhận..." 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            placeholderTextColor="#94A3B8"
          />
        </View>
        <TouchableOpacity 
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]} 
          onPress={() => setFilterModalVisible(true)}
        >
          <Filter size={22} color={hasActiveFilters ? '#fff' : '#64748B'} />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Chips hiển thị các lọc đang áp dụng */}
      {hasActiveFilters && (
        <View style={styles.activeFilterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {statusFilter !== 'ALL' && (
              <View style={styles.chip}><Text style={styles.chipText}>TT: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}</Text></View>
            )}
            {addressFilter !== 'ALL' && (
              <View style={styles.chip}><Text style={styles.chipText}>Kho: {addresses.find(a => a.id === addressFilter)?.contact_name}</Text></View>
            )}
            {(startDate || endDate) && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {startDate ? formatDateLabel(startDate) : '...'} → {endDate ? formatDateLabel(endDate) : '...'}
                </Text>
              </View>
            )}
            <TouchableOpacity onPress={resetFilters} style={styles.clearBtn}>
              <Text style={styles.clearText}>Xóa lọc</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredData}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} colors={['#4F46E5']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Package size={80} color="#E2E8F0" />
            <Text style={styles.emptyText}>Không tìm thấy đơn hàng nào.</Text>
          </View>
        ) : <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />}
      />

      {/* FAB - Nút tạo đơn */}
      {userRole !== 'manager' && (
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/orders/create' as any)}>
          <Plus size={32} color="#fff" />
        </TouchableOpacity>
      )}

      {/* MODAL BỘ LỌC NÂNG CAO */}
      <Modal visible={isFilterModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Filter size={24} color="#1E293B" />
                <Text style={styles.modalTitle}>Bộ lọc nâng cao</Text>
              </View>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)} style={styles.closeBtn}>
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionLabel}>TRẠNG THÁI VẬN CHUYỂN</Text>
              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity 
                    key={opt.value} 
                    style={[styles.statusOption, statusFilter === opt.value && styles.statusOptionActive]}
                    onPress={() => setStatusFilter(opt.value)}
                  >
                    <Text style={[styles.statusOptionText, statusFilter === opt.value && styles.statusOptionTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>LỌC THEO KHO GỬI</Text>
              {addresses.map(addr => (
                <TouchableOpacity 
                  key={addr.id} 
                  style={[styles.addrItem, addressFilter === addr.id && styles.addrActive]}
                  onPress={() => setAddressFilter(addr.id)}
                >
                  <Text style={[styles.addrText, addressFilter === addr.id && styles.addrActiveText]}>{addr.contact_name}</Text>
                  {addressFilter === addr.id && <CheckCircle2 size={18} color="#4F46E5" />}
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionLabel}>KHOẢNG THỜI GIAN GỬI</Text>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                   <Text style={styles.dateSubLabel}>Từ ngày</Text>
                   <TouchableOpacity style={styles.datePickerToggle} onPress={() => setShowStartPicker(true)}>
                     <Text style={[styles.dateText, !startDate && { color: '#CBD5E0' }]}>{formatDateLabel(startDate)}</Text>
                     <Calendar size={16} color="#4F46E5" />
                   </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={styles.dateSubLabel}>Đến ngày</Text>
                   <TouchableOpacity style={styles.datePickerToggle} onPress={() => setShowEndPicker(true)}>
                     <Text style={[styles.dateText, !endDate && { color: '#CBD5E0' }]}>{formatDateLabel(endDate)}</Text>
                     <Calendar size={16} color="#4F46E5" />
                   </TouchableOpacity>
                </View>
              </View>

              {/* Native DateTime Pickers */}
              {showStartPicker && (
                <DateTimePicker
                  value={startDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onStartDateChange}
                  maximumDate={endDate || undefined}
                />
              )}
              {showEndPicker && (
                <DateTimePicker
                  value={endDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndDateChange}
                  minimumDate={startDate || undefined}
                />
              )}
              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                <Text style={styles.resetBtnText}>Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.applyBtnText}>Áp dụng lọc</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: Platform.OS === 'ios' ? 10 : 25, paddingBottom: 25, backgroundColor: '#fff' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  refreshBtn: { padding: 12, backgroundColor: '#F8FAFC', borderRadius: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  
  searchSection: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 15, gap: 12, alignItems: 'center' },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#334155' },
  filterBtn: { width: 56, height: 56, backgroundColor: '#fff', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#000', shadowOpacity: 0.03 },
  filterBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  filterDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },

  activeFilterContainer: { marginBottom: 15 },
  chip: { backgroundColor: '#EFF6FF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  chipText: { fontSize: 11, fontWeight: '800', color: '#1E40AF' },
  clearBtn: { justifyContent: 'center', paddingLeft: 5 },
  clearText: { fontSize: 12, fontWeight: '900', color: '#94A3B8', textDecorationLine: 'underline' },

  listPadding: { paddingHorizontal: 20, paddingBottom: 120 },
  orderCard: { 
    backgroundColor: '#fff', 
    borderRadius: 30, 
    padding: 24, 
    marginBottom: 16, 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowRadius: 20, 
    shadowOffset: { width: 0, height: 8 },
    borderWidth: 1,
    borderColor: '#F8FAFC'
  },
  cardMainContent: { flexDirection: 'row', alignItems: 'center' },
  statusIconBox: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  orderInfo: { flex: 1 },
  statusTitle: { fontSize: 17, fontWeight: '900', color: '#334155', marginBottom: 4 },
  orderDetailText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeText: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  idTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  idTagText: { fontSize: 10, fontWeight: '900', color: '#1E40AF' },

  actionRow: { flexDirection: 'row', marginTop: 18, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  actionBtnText: { fontSize: 11, fontWeight: '800', marginLeft: 4 },
  trackingBtn: { borderColor: '#E0E7FF', backgroundColor: '#F5F7FF' },
  cancelBtn: { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' },
  deleteBtn: { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  
  priceGroup: { flex: 1, alignItems: 'flex-end' },
  priceValue: { fontSize: 15, fontWeight: '900', color: '#059669' },

  fab: { position: 'absolute', bottom: 30, right: 25, width: 64, height: 64, borderRadius: 32, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  emptyContainer: { alignItems: 'center', marginTop: 80, opacity: 0.5 },
  emptyText: { marginTop: 20, color: '#64748B', fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, height: height * 0.85 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  closeBtn: { padding: 8, backgroundColor: '#F8FAFC', borderRadius: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 15, marginTop: 10 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  statusOption: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' },
  statusOptionActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  statusOptionText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  statusOptionTextActive: { color: '#4F46E5' },
  addrItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 10 },
  addrActive: { borderColor: '#4F46E5', backgroundColor: '#F5F7FF' },
  addrText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  addrActiveText: { color: '#4F46E5' },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  dateSubLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 6, marginLeft: 4 },
  datePickerToggle: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  dateText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  modalFooter: { flexDirection: 'row', gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  resetBtn: { flex: 1, paddingVertical: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  resetBtnText: { color: '#64748B', fontWeight: '800' },
  applyBtn: { flex: 2, backgroundColor: '#1E293B', paddingVertical: 18, borderRadius: 20, alignItems: 'center', elevation: 5 },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' }
});