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
  SafeAreaView, 
  Platform,
  Dimensions
} from 'react-native';
// Sử dụng chuẩn thư viện di động cho dự án Expo
import { 
  Ionicons, 
  MaterialCommunityIcons 
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Đảm bảo đường dẫn tới tệp cấu hình Supabase chính xác
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * Màn hình Đối soát COD (Dành cho Quản lý)
 * Chức năng: Chốt tiền thu hộ từ Shipper và xác nhận đã thanh toán cho Shop (Người gửi).
 * Quy trình: Chuyển financial_status từ 'collected' sang 'paid'.
 */
export default function ReconciliationScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // 1. Tải danh sách đơn hàng đang chờ đối soát tài chính
  const fetchPendingReconciliation = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      // Lấy các đơn hàng có trạng thái tài chính là 'collected' (Bưu tá đã thu tiền)
      const { data, error } = await supabase
        .from('tb_orders')
        .select(`
          *,
          shop:user_id (full_name, phone_number),
          shipper:shipper_id (full_name, phone_number)
        `)
        .eq('financial_status', 'collected')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Lỗi tải dữ liệu đối soát:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchPendingReconciliation();
  }, [fetchPendingReconciliation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingReconciliation();
  };

  // 2. Logic: Xác nhận đối soát và thanh toán tiền về cho Shop
  const handleConfirmReconciliation = (orderId: string, amount: number) => {
    Alert.alert(
      'Xác nhận thanh toán',
      `Xác nhận bưu tá đã nộp đủ tiền mặt và hệ thống đã chuyển khoản ${amount.toLocaleString()}đ cho chủ shop?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Xác nhận Xong', 
          onPress: async () => {
            try {
              setProcessingId(orderId);
              
              // 2.1 Cập nhật trạng thái tài chính của đơn hàng
              const { error: updateError } = await supabase
                .from('tb_orders')
                .update({ financial_status: 'paid' })
                .eq('id', orderId);

              if (updateError) throw updateError;

              // 2.2 Ghi lại lịch sử hành trình đối soát (Audit Log)
              const { data: authData } = await supabase.auth.getUser();
              await supabase.from('tb_order_tracking').insert([{
                order_id: orderId,
                status: 'DELIVERED', // Vận chuyển đã xong, đây là bước chốt tiền
                note: `QUẢN TRỊ: Đã hoàn tất đối soát COD. Tiền đã được trả cho Shop.`,
                updated_by: authData?.user?.id
              }]);

              // Cập nhật giao diện tại chỗ
              setOrders(prev => prev.filter(o => o.id !== orderId));
              Alert.alert('Thành công', 'Đơn hàng đã được chốt sổ tài chính.');
            } catch (e: any) {
              Alert.alert('Lỗi', 'Không thể cập nhật đối soát đơn hàng.');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  // Tính tổng tiền đang nằm trong ví "chờ chốt"
  const totalCodAmount = orders.reduce((sum, item) => sum + (Number(item.cod_amount) || 0), 0);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.orderCard}>
      <View style={styles.cardHeader}>
        <View style={styles.shopInfo}>
          <Ionicons name="storefront" size={16} color="#4F46E5" />
          <Text style={styles.shopName} numberOfLines={1}>{item.shop?.full_name || 'Khách hàng ẩn danh'}</Text>
        </View>
        <Text style={styles.orderIdText}>#{item.id.slice(0, 8).toUpperCase()}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Khách nhận:</Text>
          <Text style={styles.detailValue}>{item.receiver_name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Shipper giao:</Text>
          <Text style={[styles.detailValue, { color: '#0369A1' }]}>{item.shipper?.full_name || 'Chưa rõ'}</Text>
        </View>
        
        <View style={styles.moneyGrid}>
          <View style={styles.moneyBox}>
            <Text style={styles.moneyLabel}>TIỀN COD</Text>
            <Text style={styles.codValue}>{Number(item.cod_amount).toLocaleString()}đ</Text>
          </View>
          <View style={styles.moneyBox}>
            <Text style={styles.moneyLabel}>PHÍ SHIP</Text>
            <Text style={styles.feeValue}>{Number(item.shipping_fee).toLocaleString()}đ</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.confirmBtn, processingId === item.id && { opacity: 0.7 }]}
        onPress={() => handleConfirmReconciliation(item.id, item.cod_amount)}
        disabled={!!processingId}
      >
        {processingId === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.confirmBtnText}>XÁC NHẬN ĐÃ TRẢ TIỀN</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header điều hướng */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Đối Soát Tiền COD</Text>
          <Text style={styles.headerSubtitle}>Quản lý dòng tiền hệ thống</Text>
        </View>
      </View>

      {/* Thẻ tóm tắt dòng tiền */}
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Tiền COD Shipper đang cầm</Text>
          <Text style={styles.summaryValue}>{totalCodAmount.toLocaleString()}đ</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryCount}>{orders.length} Đơn</Text>
        </View>
        <MaterialCommunityIcons name="finance" size={80} color="rgba(255,255,255,0.1)" style={styles.bgIcon} />
      </View>

      {/* Danh sách các đơn chờ xử lý */}
      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={70} color="#D1D5DB" />
            <Text style={styles.emptyText}>Hiện tại không còn đơn hàng nào cần đối soát.</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9',
    paddingTop: Platform.OS === 'ios' ? 10 : 25
  },
  backBtn: { padding: 8, marginRight: 10 },
  headerTitleBox: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  summaryCard: {
    margin: 16,
    backgroundColor: '#059669',
    borderRadius: 28,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#059669',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    position: 'relative',
    overflow: 'hidden'
  },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 30, fontWeight: '900' },
  summaryBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  summaryCount: { color: '#fff', fontWeight: '900', fontSize: 14 },
  bgIcon: { position: 'absolute', right: -10, bottom: -10 },

  listContainer: { padding: 16, paddingBottom: 40 },
  orderCard: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#F1F5F9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.03
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  shopInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  shopName: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginLeft: 8 },
  orderIdText: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },
  
  cardBody: { marginBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  detailValue: { fontSize: 13, color: '#1E293B', fontWeight: '800' },
  
  moneyGrid: { 
    flexDirection: 'row', 
    backgroundColor: '#F8FAFC', 
    padding: 16, 
    borderRadius: 18, 
    marginTop: 12 
  },
  moneyBox: { flex: 1 },
  moneyLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', marginBottom: 6 },
  codValue: { fontSize: 18, fontWeight: '900', color: '#059669' },
  feeValue: { fontSize: 18, fontWeight: '800', color: '#475569' },
  
  confirmBtn: { 
    backgroundColor: '#4F46E5', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    borderRadius: 16,
    elevation: 2
  },
  confirmBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 50 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#94A3B8', fontSize: 15, fontWeight: '600', lineHeight: 22 }
});