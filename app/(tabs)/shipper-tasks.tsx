import React, { useEffect, useState, useCallback } from 'react';
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
// Đảm bảo sử dụng lucide-react-native cho dự án Expo
import { 
  Package, 
  MapPin, 
  Truck, 
  Info, 
  CheckCircle, 
  Navigation,
  PhoneCall,
  RefreshCcw,
  ClipboardList,
  AlertTriangle,
  X,
  ChevronRight,
  MessageSquare
} from 'lucide-react-native';
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * Màn hình Vận hành dành cho Shipper (Các đơn cần giao)
 * Tách biệt hoàn toàn logic tìm đơn và thực hiện giao hàng.
 * Đảm bảo ghi log tracking cho mọi thay đổi trạng thái.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<'available' | 'my-jobs'>('available');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // States cho Modal Báo cáo & Hủy
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const failureReasons = [
    'Khách không nghe máy',
    'Khách hẹn ngày khác',
    'Sai địa chỉ/Số điện thoại',
    'Khách từ chối nhận hàng',
    'Hàng bị hỏng hóc'
  ];

  // 1. Tải danh sách đơn hàng từ Supabase
  const fetchOrders = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const userId = authData.user.id;
      setCurrentUserId(userId);

      let query = supabase.from('tb_orders').select('*');
      if (activeTab === 'available') {
        // Đơn hàng chờ lấy và chưa có ai nhận
        query = query.eq('delivery_status', 'PENDING').is('shipper_id', null);
      } else {
        // Đơn hàng shipper này đang phụ trách (không bao gồm đơn đã giao xong)
        query = query.eq('shipper_id', userId).neq('delivery_status', 'DELIVERED');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // 2. Logic: Nhận đơn hàng mới (PENDING -> SHIPPING)
  const handlePickOrder = (orderId: string) => {
    Alert.alert('Nhận giao đơn', 'Bạn xác nhận sẽ lấy hàng và chịu trách nhiệm giao đơn này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đồng ý', onPress: async () => {
        try {
          const { error } = await supabase
            .from('tb_orders')
            .update({ delivery_status: 'SHIPPING', shipper_id: currentUserId })
            .eq('id', orderId)
            .eq('delivery_status', 'PENDING');
          
          if (error) throw error;
          
          // GHI LOG HÀNH TRÌNH: NHẬN ĐƠN
          await supabase.from('tb_order_tracking').insert([{
            order_id: orderId,
            status: 'SHIPPING',
            note: 'Shipper đã tiếp nhận đơn hàng thành công.',
            updated_by: currentUserId
          }]);
          
          Alert.alert('Thành công', 'Đã thêm đơn hàng vào danh sách "Đang giao".');
          fetchOrders();
        } catch (e) { Alert.alert('Lỗi', 'Đơn hàng không còn khả dụng.'); }
      }}
    ]);
  };

  // 3. Logic: Giao xong thành công (SHIPPING -> DELIVERED)
  const handleCompleteDelivery = (orderId: string) => {
    Alert.alert('Giao xong', 'Xác nhận bưu tá đã thu COD và giao hàng thành công?', [
      { text: 'Chưa', style: 'cancel' },
      { text: 'Xác nhận', onPress: async () => {
        try {
          const { error } = await supabase
            .from('tb_orders')
            .update({ delivery_status: 'DELIVERED', financial_status: 'collected' })
            .eq('id', orderId);

          if (error) throw error;

          // GHI LOG HÀNH TRÌNH: GIAO XONG
          await supabase.from('tb_order_tracking').insert([{
            order_id: orderId,
            status: 'DELIVERED',
            note: 'Giao hàng thành công. Shipper đã thu hộ tiền COD.',
            updated_by: currentUserId
          }]);

          Alert.alert('Thành công');
          fetchOrders();
        } catch (e) { Alert.alert('Lỗi cập nhật'); }
      }}
    ]);
  };

  // 4. Logic: Báo cáo sự cố hoặc Hủy đơn (Phân tách 2 hành động)
  const handleReportAction = async (type: 'incident' | 'cancel') => {
    if (!reportReason) {
      Alert.alert('Thông báo', 'Vui lòng chọn một lý do cụ thể.');
      return;
    }

    setSubmitting(true);
    try {
      const fullNote = `${reportReason}${reportNote ? ': ' + reportNote : ''}`;

      if (type === 'cancel') {
        // HÀNH ĐỘNG HỦY: Thay đổi trạng thái đơn thành CANCELLED
        const { error } = await supabase
          .from('tb_orders')
          .update({ delivery_status: 'CANCELLED' })
          .eq('id', selectedOrderId);
        if (error) throw error;
      }

      // GHI LOG HÀNH TRÌNH (Luôn ghi lại mọi báo cáo cho sự minh bạch)
      const logStatus = type === 'cancel' ? 'CANCELLED' : 'SHIPPING';
      const logNote = type === 'cancel' ? `YÊU CẦU HỦY ĐƠN: ${fullNote}` : `BÁO CÁO SỰ CỐ: ${fullNote}`;

      await supabase.from('tb_order_tracking').insert([{
        order_id: selectedOrderId,
        status: logStatus,
        note: logNote,
        updated_by: currentUserId
      }]);

      setReportModalVisible(false);
      setReportReason('');
      setReportNote('');
      Alert.alert('Thành công', type === 'cancel' ? 'Đơn hàng đã được chuyển sang trạng thái Hủy.' : 'Đã ghi nhận sự cố vào lịch sử hành trình.');
      fetchOrders();
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể gửi báo cáo.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isAvailable = activeTab === 'available';
    const isShipping = item.delivery_status === 'SHIPPING';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: isShipping ? '#DBEAFE' : '#F3F4F6' }]}>
            <Text style={[styles.badgeText, { color: isShipping ? '#1E40AF' : '#64748B' }]}>
              {item.delivery_status === 'PENDING' ? 'SẴN SÀNG' : 'ĐANG GIAO'}
            </Text>
          </View>
          <Text style={styles.orderIdText}>#{item.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Package size={20} color="#1E40AF" />
            <Text style={styles.infoTitle} numberOfLines={1}>{item.order_contents || 'Hàng hóa tổng hợp'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={20} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressText}>{item.receiver_address_detail}</Text>
              <Text style={styles.customerText}>{item.receiver_name} • {item.receiver_phone}</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>TIỀN COD</Text>
              <Text style={styles.codValue}>{Number(item.cod_amount).toLocaleString()}đ</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>KHỐI LƯỢNG</Text>
              <Text style={styles.weightValue}>{item.weight_gram}g</Text>
            </View>
          </View>
        </View>

        {isAvailable ? (
          <TouchableOpacity style={styles.pickButton} onPress={() => handlePickOrder(item.id)}>
            <Truck size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.pickButtonText}>NHẬN GIAO ĐƠN</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.iconBtn}><Navigation size={22} color="#475569" /></TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { marginHorizontal: 10 }]}><PhoneCall size={22} color="#475569" /></TouchableOpacity>
            <TouchableOpacity 
              style={[styles.pickButton, { flex: 1, backgroundColor: '#10B981' }]} 
              onPress={() => handleCompleteDelivery(item.id)}
            >
              <CheckCircle size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.pickButtonText}>GIAO XONG</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconBtn, { backgroundColor: '#FEE2E2', marginLeft: 10 }]}
              onPress={() => {
                setSelectedOrderId(item.id);
                setReportModalVisible(true);
              }}
            >
              <AlertTriangle size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vận Hành Đơn Hàng</Text>
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'available' && styles.tabActive]} 
            onPress={() => setActiveTab('available')}
          >
            <Package size={18} color={activeTab === 'available' ? '#1E40AF' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>Tìm đơn mới</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabItem, activeTab === 'my-jobs' && styles.tabActive]} 
            onPress={() => setActiveTab('my-jobs')}
          >
            <ClipboardList size={18} color={activeTab === 'my-jobs' ? '#1E40AF' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'my-jobs' && styles.tabTextActive]}>Đang giao</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E40AF']} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Info size={64} color="#CBD5E0" />
              <Text style={styles.emptyText}>Hiện tại không có đơn hàng nào.</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                <RefreshCcw size={16} color="#1E40AF" style={{ marginRight: 6 }} />
                <Text style={styles.refreshBtnText}>Làm mới</Text>
              </TouchableOpacity>
            </View>
          ) : <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 60 }} />
        }
      />

      <Modal visible={reportModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <AlertTriangle size={24} color="#EF4444" />
                <Text style={styles.modalTitle}>Báo cáo đơn hàng</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <X size={28} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.reasonGrid}>
              {failureReasons.map((reason) => (
                <TouchableOpacity 
                  key={reason} 
                  style={[styles.reasonChip, reportReason === reason && styles.reasonChipActive]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextActive]}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput 
              style={styles.reasonInput} 
              placeholder="Ghi chú chi tiết sự cố..." 
              multiline 
              numberOfLines={4}
              value={reportNote}
              onChangeText={setReportNote}
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelLink} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.modalCancelLinkText}>Quay lại</Text>
              </TouchableOpacity>
              
              <View style={styles.modalActionGroup}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: '#F59E0B' }, (!reportReason || submitting) && { opacity: 0.5 }]} 
                  onPress={() => handleReportAction('incident')}
                  disabled={!reportReason || submitting}
                >
                  <Text style={styles.modalBtnText}>BÁO SỰ CỐ</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: '#EF4444' }, (!reportReason || submitting) && { opacity: 0.5 }]} 
                  onPress={() => handleReportAction('cancel')}
                  disabled={!reportReason || submitting}
                >
                  <Text style={styles.modalBtnText}>HỦY ĐƠN</Text>
                </TouchableOpacity>
              </View>
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
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 15 },
  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4 },
  tabItem: { flex: 1, flexDirection: 'row', paddingVertical: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  tabText: { fontSize: 13, fontWeight: '700', color: '#94A3B8', marginLeft: 8 },
  tabTextActive: { color: '#1E40AF' },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 28, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#1E40AF', shadowOpacity: 0.06, shadowRadius: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  orderIdText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  cardBody: { marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  infoTitle: { marginLeft: 12, fontSize: 17, fontWeight: '700', color: '#1E293B', flex: 1 },
  addressText: { marginLeft: 12, fontSize: 15, color: '#475569', fontWeight: '600', lineHeight: 22 },
  customerText: { marginLeft: 12, fontSize: 12, color: '#94A3B8', marginTop: 4 },
  statsContainer: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 18, marginTop: 8 },
  statBox: { flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', marginBottom: 5 },
  codValue: { fontSize: 17, fontWeight: '900', color: '#059669' },
  weightValue: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  pickButton: { backgroundColor: '#1E40AF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 18, height: 56 },
  pickButtonText: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', marginTop: 16, color: '#94A3B8', fontSize: 16, fontWeight: '600' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 25, padding: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  refreshBtnText: { color: '#1E40AF', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginLeft: 12 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  reasonChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  reasonChipActive: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  reasonText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  reasonTextActive: { color: '#EF4444' },
  reasonInput: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', height: 100, textAlignVertical: 'top', marginBottom: 25 },
  modalFooter: { flexDirection: 'row', alignItems: 'center' },
  modalCancelLink: { flex: 1, paddingVertical: 15 },
  modalCancelLinkText: { fontSize: 14, fontWeight: '700', color: '#64748B', textAlign: 'center' },
  modalActionGroup: { flex: 3, flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', elevation: 2 },
  modalBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
});