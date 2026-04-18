import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  SafeAreaView, 
  Alert,
  Dimensions,
  Platform,
  Modal,
  TextInput
} from 'react-native';
// Sử dụng MaterialCommunityIcons cho hình ảnh xe máy (moped)
import { 
  MaterialCommunityIcons 
} from '@expo/vector-icons';
import { 
  Package, 
  MapPin, 
  CheckCircle, 
  PhoneCall, 
  AlertTriangle, 
  X, 
  Store, 
  CheckSquare, 
  Square,
  Info,
  RefreshCcw
} from 'lucide-react-native';
// Đảm bảo đường dẫn import chính xác với cấu trúc thư mục của bạn
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * MÀN HÌNH VẬN HÀNH SHIPPER (app/(tabs)/shipper-tasks.tsx)
 * - Đã cập nhật Icon vận chuyển thành Xe máy (moped).
 * - Gom nhóm đơn hàng theo địa chỉ lấy hàng (tb_addresses).
 * - Tự động ghi log tb_order_tracking và tb_notifications cho mọi hành động (Nhận đơn, Giao đơn, Báo lỗi, Hủy đơn).
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<'available' | 'my-jobs'>('available');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // States cho việc chọn nhiều đơn hàng
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // States cho Modal báo cáo sự cố
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');

  const failureReasons = [
    'Khách không nghe máy',
    'Khách hẹn ngày khác',
    'Sai địa chỉ/Số điện thoại',
    'Khách từ chối nhận hàng'
  ];

  // 1. Tải danh sách đơn hàng từ Supabase
  const fetchOrders = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      setCurrentUserId(authData.user.id);

      // Join với tb_addresses để lấy thông tin chi tiết kho lấy hàng
      let query = supabase
        .from('tb_orders')
        .select(`
          *,
          pickup_address:pickup_address_id (*)
        `);

      if (activeTab === 'available') {
        // Tab Tìm đơn: Đơn chưa có shipper và ở trạng thái PENDING
        query = query.eq('delivery_status', 'PENDING').is('shipper_id', null);
      } else {
        // Tab Việc của tôi: Đơn của chính shipper này chưa hoàn tất
        query = query.eq('shipper_id', authData.user.id).neq('delivery_status', 'DELIVERED');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      
      setOrders(data || []);
      setSelectedOrderIds([]); 
    } catch (error: any) {
      console.error('Lỗi tải đơn hàng:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, refreshing]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 2. Logic gom nhóm đơn theo địa chỉ lấy hàng (tb_addresses.id)
  const groupedOrders = useMemo(() => {
    if (activeTab !== 'available') return [];
    
    const groups: { [key: string]: any } = {};
    orders.forEach(order => {
      const addrId = order.pickup_address_id || 'unassigned';
      if (!groups[addrId]) {
        groups[addrId] = {
          addressInfo: order.pickup_address,
          orders: []
        };
      }
      groups[addrId].orders.push(order);
    });
    return Object.entries(groups).map(([id, data]) => ({ id, ...data }));
  }, [orders, activeTab]);

  // 3. Xử lý Lựa chọn (Checkbox) đơn hàng
  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleGroupSelection = (groupOrders: any[]) => {
    const groupIds = groupOrders.map(o => o.id);
    const allInGroupSelected = groupIds.every(id => selectedOrderIds.includes(id));

    if (allInGroupSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  // 4. Nhận giao đơn hàng loạt + Lưu Tracking + Gửi Thông báo
  const handleBatchPickOrders = async () => {
    if (selectedOrderIds.length === 0) return;

    Alert.alert(
      'Xác nhận nhận đơn',
      `Bạn chắc chắn muốn nhận giao ${selectedOrderIds.length} đơn hàng đã chọn bằng xe máy?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', onPress: async () => {
          try {
            setIsProcessingBatch(true);
            
            // 4.1 Cập nhật trạng thái và bưu tá trong bảng tb_orders
            const { error: updateError } = await supabase
              .from('tb_orders')
              .update({ delivery_status: 'SHIPPING', shipper_id: currentUserId })
              .in('id', selectedOrderIds);

            if (updateError) throw updateError;

            // Lấy danh sách các đơn vừa chọn để có user_id gửi thông báo
            const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));

            // 4.2 Chuẩn bị data cho Tracking và Notification
            const trackingLogs = selectedOrders.map(order => ({
              order_id: order.id,
              status: 'SHIPPING',
              note: 'Shipper đã tiếp nhận đơn hàng tại kho và đang bắt đầu giao bằng xe máy.',
              updated_by: currentUserId
            }));

            const notificationLogs = selectedOrders.map(order => ({
              user_id: order.user_id,
              title: 'Đơn hàng đang được giao',
              content: `Đơn #${order.id.slice(0, 8).toUpperCase()} đang được bưu tá giao tới bạn bằng xe máy.`,
              order_id: order.id,
              is_read: false
            }));

            // Thực hiện lưu đồng thời
            await Promise.all([
              supabase.from('tb_order_tracking').insert(trackingLogs),
              supabase.from('tb_notifications').insert(notificationLogs)
            ]);

            Alert.alert('Thành công', `Đã nhận giao ${selectedOrderIds.length} đơn hàng.`);
            fetchOrders();
          } catch (e: any) {
            Alert.alert('Lỗi', 'Không thể nhận đơn hàng loạt.');
          } finally {
            setIsProcessingBatch(false);
          }
        }}
      ]
    );
  };

  // 5. Giao hàng thành công + Lưu Tracking + Gửi Thông báo
  const handleCompleteDelivery = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    Alert.alert('Xác nhận', 'Bạn đã giao đơn và thu tiền thành công?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đồng ý', onPress: async () => {
        try {
          const { error } = await supabase
            .from('tb_orders')
            .update({ delivery_status: 'DELIVERED', financial_status: 'collected' })
            .eq('id', orderId);

          if (error) throw error;

          // Lưu hành trình và gửi tin nhắn cho khách
          await Promise.all([
            supabase.from('tb_order_tracking').insert([{ 
              order_id: orderId, 
              status: 'DELIVERED', 
              note: 'Giao hàng và thu hộ tiền thành công bằng xe máy.', 
              updated_by: currentUserId 
            }]),
            supabase.from('tb_notifications').insert([{
              user_id: order.user_id,
              title: 'Giao hàng thành công',
              content: `Đơn #${orderId.slice(0, 8).toUpperCase()} đã được giao thành công. Cảm ơn bạn!`,
              order_id: orderId,
              is_read: false
            }])
          ]);

          fetchOrders();
        } catch (e) {
          Alert.alert('Lỗi', 'Thao tác không thành công.');
        }
      }}
    ]);
  };

  // 6. Xử lý Báo lỗi hoặc Hủy đơn từ Shipper
  const handleActionWithStatus = async (status: 'CANCELLED' | 'ISSUE') => {
    if (!selectedOrderId || !reportReason) {
      Alert.alert('Thông báo', 'Vui lòng chọn lý do xử lý.');
      return;
    }

    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) return;

    try {
      setLoading(true);
      const fullNote = `${reportReason}${reportNote ? ': ' + reportNote : ''}`;

      // Cập nhật trạng thái đơn
      const { error } = await supabase
        .from('tb_orders')
        .update({ delivery_status: status })
        .eq('id', selectedOrderId);

      if (error) throw error;

      // Lưu nhật ký và thông báo cho khách hàng
      await Promise.all([
        supabase.from('tb_order_tracking').insert([{ 
          order_id: selectedOrderId, 
          status: status, 
          note: `Bưu tá báo: ${fullNote}`, 
          updated_by: currentUserId 
        }]),
        supabase.from('tb_notifications').insert([{
          user_id: order.user_id,
          title: status === 'CANCELLED' ? 'Đơn hàng bị hủy' : 'Sự cố vận chuyển',
          content: `Đơn #${selectedOrderId.slice(0, 8).toUpperCase()}: ${reportReason}. Vui lòng liên hệ hỗ trợ.`,
          order_id: selectedOrderId,
          is_read: false
        }])
      ]);

      setReportModalVisible(false);
      setReportReason('');
      setReportNote('');
      fetchOrders();
    } catch (e) {
      Alert.alert('Lỗi', 'Thao tác thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const renderGroupedItem = ({ item }: { item: any }) => {
    const isAllSelected = item.orders.every((o: any) => selectedOrderIds.includes(o.id));
    const selectedCount = item.orders.filter((o: any) => selectedOrderIds.includes(o.id)).length;

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <TouchableOpacity onPress={() => toggleGroupSelection(item.orders)} style={styles.checkboxContainer}>
            {isAllSelected ? <CheckSquare size={24} color="#1E40AF" /> : (selectedCount > 0 ? <CheckCircle size={24} color="#1E40AF" /> : <Square size={24} color="#CBD5E0" />)}
          </TouchableOpacity>
          <View style={styles.groupInfo}>
            <View style={styles.row}>
              <Store size={16} color="#1E40AF" />
              <Text style={styles.groupTitle}>{item.addressInfo?.contact_name || 'Kho hàng lẻ'}</Text>
            </View>
            <Text style={styles.groupAddress} numberOfLines={1}>{item.addressInfo?.address_detail || 'Địa chỉ kho'}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{item.orders.length} đơn</Text>
          </View>
        </View>

        <View style={styles.innerList}>
          {item.orders.map((order: any) => (
            <TouchableOpacity 
              key={order.id} 
              style={styles.orderRow} 
              onPress={() => toggleOrderSelection(order.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.miniCheckbox, selectedOrderIds.includes(order.id) && styles.miniCheckboxActive]}>
                {selectedOrderIds.includes(order.id) && <CheckCircle size={14} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.innerOrderTitle} numberOfLines={1}>{order.order_contents || 'Hàng hóa'}</Text>
                <Text style={styles.innerOrderSub}>Giao đến: {order.receiver_address_detail}</Text>
              </View>
              <Text style={styles.innerCod}>{Number(order.cod_amount).toLocaleString()}đ</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderMyJobItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { borderLeftColor: '#3B82F6', borderLeftWidth: 5 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
          <Text style={[styles.badgeText, { color: '#1E40AF' }]}>ĐANG GIAO</Text>
        </View>
        <Text style={styles.orderIdText}>#{item.id.slice(0, 8).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.infoRow}><Package size={18} color="#1E40AF" /><Text style={styles.infoTitle}>{item.order_contents || 'Hàng hóa'}</Text></View>
        <View style={styles.infoRow}><MapPin size={18} color="#EF4444" /><View style={{flex:1}}><Text style={styles.addressText}>{item.receiver_address_detail}</Text><Text style={styles.customerText}>{item.receiver_name} • {item.receiver_phone}</Text></View></View>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}><Text style={styles.statLabel}>TIỀN COD</Text><Text style={styles.codValue}>{Number(item.cod_amount).toLocaleString()}đ</Text></View>
          <View style={styles.statBox}><Text style={styles.statLabel}>KHỐI LƯỢNG</Text><Text style={styles.weightValue}>{item.weight_gram}g</Text></View>
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.iconBtn}><PhoneCall size={22} color="#475569" /></TouchableOpacity>
        <TouchableOpacity style={[styles.pickButton, { flex: 1, backgroundColor: '#10B981', marginLeft: 10 }]} onPress={() => handleCompleteDelivery(item.id)}>
          <MaterialCommunityIcons name="moped" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.pickButtonText}>GIAO XONG</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#FEE2E2', marginLeft: 10 }]} onPress={() => { setSelectedOrderId(item.id); setReportModalVisible(true); }}>
          <AlertTriangle size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header & Tabs */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vận Hành Đơn Hàng</Text>
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'available' && styles.tabActive]} onPress={() => setActiveTab('available')}>
            <Package size={18} color={activeTab === 'available' ? '#1E40AF' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>Tìm đơn mới</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'my-jobs' && styles.tabActive]} onPress={() => setActiveTab('my-jobs')}>
            <MaterialCommunityIcons 
              name="moped" 
              size={22} 
              color={activeTab === 'my-jobs' ? '#1E40AF' : '#94A3B8'} 
            />
            <Text style={[styles.tabText, activeTab === 'my-jobs' && styles.tabTextActive]}>Đang giao</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={activeTab === 'available' ? groupedOrders : orders}
        renderItem={activeTab === 'available' ? renderGroupedItem : renderMyJobItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchOrders} colors={['#1E40AF']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Info size={64} color="#CBD5E0" />
            <Text style={styles.emptyText}>Không tìm thấy đơn hàng nào.</Text>
            <TouchableOpacity onPress={fetchOrders} style={styles.refreshBtn}>
              <RefreshCcw size={16} color="#1E40AF" />
              <Text style={styles.refreshBtnText}>Tải lại trang</Text>
            </TouchableOpacity>
          </View>
        ) : <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 60 }} />}
      />

      {/* Batch Action Bar */}
      {selectedOrderIds.length > 0 && activeTab === 'available' && (
        <View style={styles.batchFooter}>
          <View>
            <Text style={styles.batchLabel}>Đã chọn {selectedOrderIds.length} đơn</Text>
            <Text style={styles.batchSub}>Chuẩn bị lộ trình xe máy</Text>
          </View>
          <TouchableOpacity 
            style={[styles.batchBtn, isProcessingBatch && { opacity: 0.7 }]} 
            onPress={handleBatchPickOrders}
            disabled={isProcessingBatch}
          >
            {isProcessingBatch ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="moped" size={24} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.batchBtnText}>NHẬN GIAO NGAY</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Report Modal */}
      <Modal visible={reportModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={24} color="#EF4444" />
                <Text style={styles.modalTitle}>Báo cáo sự cố</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}><X size={28} color="#64748B" /></TouchableOpacity>
            </View>
            <View style={styles.reasonGrid}>
              {failureReasons.map((r) => (
                <TouchableOpacity key={r} style={[styles.reasonChip, reportReason === r && styles.reasonChipActive]} onPress={() => setReportReason(r)}>
                  <Text style={[styles.reasonText, reportReason === r && styles.reasonTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.reasonInput} placeholder="Mô tả chi tiết sự cố..." multiline value={reportNote} onChangeText={setReportNote} placeholderTextColor="#94A3B8" />
            
            <View style={styles.modalActionGroup}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F59E0B' }]} onPress={() => handleActionWithStatus('ISSUE')}>
                <Text style={styles.modalBtnText}>BÁO LỖI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleActionWithStatus('CANCELLED')}>
                <Text style={styles.modalBtnText}>HỦY ĐƠN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingTop: Platform.OS === 'ios' ? 10 : 25 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 15 },
  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4 },
  tabItem: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginLeft: 8 },
  tabTextActive: { color: '#1E40AF' },
  list: { padding: 16, paddingBottom: 150 },
  
  groupCard: { backgroundColor: '#FFF', borderRadius: 24, marginBottom: 18, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  checkboxContainer: { marginRight: 12 },
  groupInfo: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  groupAddress: { fontSize: 12, color: '#64748B', marginTop: 2 },
  countBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countText: { fontSize: 11, fontWeight: '800', color: '#1E40AF' },
  innerList: { backgroundColor: '#FAFBFF' },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  miniCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#E2E8F0', marginRight: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  miniCheckboxActive: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  innerOrderTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  innerOrderSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  innerCod: { fontSize: 13, fontWeight: '800', color: '#059669', marginLeft: 10 },

  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '900' },
  orderIdText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  cardBody: { marginBottom: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1 },
  addressText: { fontSize: 14, color: '#475569', fontWeight: '600' },
  customerText: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  statsContainer: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 14, marginTop: 8 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 8, fontWeight: '800', color: '#94A3B8', marginBottom: 2 },
  codValue: { fontSize: 15, fontWeight: '900', color: '#059669' },
  weightValue: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  iconBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  pickButton: { backgroundColor: '#1E40AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14 },
  pickButtonText: { color: '#FFF', fontWeight: '900', fontSize: 13 },

  batchFooter: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#111827', padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  batchLabel: { color: '#fff', fontSize: 16, fontWeight: '900' },
  batchSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  batchBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  batchBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: '#EFF6FF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12 },
  refreshBtnText: { color: '#1E40AF', fontSize: 13, fontWeight: '700', marginLeft: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 32, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  reasonChip: { padding: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  reasonChipActive: { backgroundColor: '#FEE2E2' },
  reasonText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  reasonTextActive: { color: '#EF4444' },
  reasonInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, height: 80, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B' },
  modalActionGroup: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  modalBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 }
});