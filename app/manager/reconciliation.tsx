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
  SafeAreaView, 
  Platform,
  Dimensions,
  LayoutAnimation
} from 'react-native';
import { 
  Ionicons, 
  MaterialCommunityIcons 
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Import tệp cấu hình Supabase
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * Interface cho dữ liệu đơn hàng đã gom nhóm
 */
interface GroupedOrder {
  shopId: string;
  shopName: string;
  shopPhone: string;
  orders: any[];
  totalCod: number;
}

/**
 * Màn hình Đối soát COD dành cho Manager
 * Gom nhóm đơn hàng theo từng Shop để quản lý dòng tiền tập trung.
 * Hỗ trợ chọn tất cả hoặc chọn lẻ từng đơn hàng để đối soát hàng loạt.
 */
export default function App() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [expandedShops, setExpandedShops] = useState<string[]>([]);

  // 1. Tải danh sách đơn hàng đã được bưu tá thu tiền (collected)
  const fetchData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data, error } = await supabase
        .from('tb_orders')
        .select(`
          *,
          shop:user_id (id, full_name, phone_number),
          shipper:shipper_id (full_name)
        `)
        .eq('financial_status', 'collected')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
      setSelectedIds([]); // Reset lựa chọn khi tải mới dữ liệu
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

  // 2. Logic gom nhóm dữ liệu theo từng Shop để hiển thị
  const groupedData = useMemo(() => {
    const groups: { [key: string]: GroupedOrder } = {};
    orders.forEach(order => {
      const shopId = order.shop?.id || 'unknown';
      if (!groups[shopId]) {
        groups[shopId] = {
          shopId,
          shopName: order.shop?.full_name || 'Shop ẩn danh',
          shopPhone: order.shop?.phone_number || '',
          orders: [],
          totalCod: 0
        };
      }
      groups[shopId].orders.push(order);
      groups[shopId].totalCod += Number(order.cod_amount) || 0;
    });
    return Object.values(groups);
  }, [orders]);

  // 3. Xử lý logic chọn đơn hàng
  const toggleSelectOrder = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectShop = (shopId: string, shopOrders: any[]) => {
    const shopOrderIds = shopOrders.map(o => o.id);
    const allSelectedInShop = shopOrderIds.every(id => selectedIds.includes(id));

    if (allSelectedInShop) {
      // Bỏ chọn toàn bộ đơn của Shop này
      setSelectedIds(prev => prev.filter(id => !shopOrderIds.includes(id)));
    } else {
      // Chọn toàn bộ đơn của Shop này (không trùng lặp)
      setSelectedIds(prev => [...new Set([...prev, ...shopOrderIds])]);
    }
  };

  const toggleExpand = (shopId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedShops(prev => 
      prev.includes(shopId) ? prev.filter(s => s !== shopId) : [...prev, shopId]
    );
  };

  // 4. Thực hiện đối soát hàng loạt các đơn đã chọn
  const handleBatchReconcile = async () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      'Xác nhận đối soát',
      `Bạn chắc chắn muốn chốt đối soát tài chính cho ${selectedIds.length} đơn hàng đã chọn?`,
      [
        { text: 'Quay lại', style: 'cancel' },
        { 
          text: 'Xác nhận hoàn tất', 
          onPress: async () => {
            try {
              setProcessing(true);
              const { data: authData } = await supabase.auth.getUser();

              // Cập nhật trạng thái 'paid' cho tất cả đơn đã chọn
              const { error } = await supabase
                .from('tb_orders')
                .update({ financial_status: 'paid' })
                .in('id', selectedIds);

              if (error) throw error;

              // Ghi log hành trình cho từng đơn hàng (Batch insert)
              const trackingLogs = selectedIds.map(id => ({
                order_id: id,
                status: 'DELIVERED',
                note: `MANAGER: Đối soát thành công. Tiền đã được trả về ví cho Shop.`,
                updated_by: authData?.user?.id
              }));
              
              await supabase.from('tb_order_tracking').insert(trackingLogs);

              Alert.alert('Thành công', `Đã hoàn thành đối soát ${selectedIds.length} đơn.`);
              fetchData();
            } catch (e: any) {
              Alert.alert('Lỗi', 'Không thể thực hiện đối soát hàng loạt.');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderShopGroup = ({ item }: { item: GroupedOrder }) => {
    const isExpanded = expandedShops.includes(item.shopId);
    const shopOrderIds = item.orders.map(o => o.id);
    const isAllSelected = shopOrderIds.every(id => selectedIds.includes(id));
    const selectedInShopCount = item.orders.filter(o => selectedIds.includes(o.id)).length;

    return (
      <View style={styles.shopGroupCard}>
        {/* Header hiển thị thông tin Shop và Checkbox tổng */}
        <View style={styles.shopHeader}>
          <TouchableOpacity 
            style={styles.checkboxTouch} 
            onPress={() => toggleSelectShop(item.shopId, item.orders)}
          >
            <Ionicons 
              name={isAllSelected ? "checkbox" : (selectedInShopCount > 0 ? "remove-circle" : "square-outline")} 
              size={26} 
              color={selectedInShopCount > 0 ? "#4F46E5" : "#CBD5E0"} 
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.shopInfoSection} onPress={() => toggleExpand(item.shopId)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopNameText}>{item.shopName}</Text>
              <Text style={styles.shopStatsText}>
                {item.orders.length} đơn • <Text style={{color: '#059669', fontWeight: '800'}}>{item.totalCod.toLocaleString()}đ</Text>
              </Text>
            </View>
            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Danh sách các đơn hàng chi tiết khi mở rộng */}
        {isExpanded && (
          <View style={styles.orderListContainer}>
            {item.orders.map((order) => (
              <TouchableOpacity 
                key={order.id} 
                style={styles.orderRow}
                onPress={() => toggleSelectOrder(order.id)}
              >
                <Ionicons 
                  name={selectedIds.includes(order.id) ? "checkbox" : "square-outline"} 
                  size={22} 
                  color={selectedIds.includes(order.id) ? "#4F46E5" : "#CBD5E0"} 
                />
                <View style={styles.orderDetailTextContainer}>
                  <Text style={styles.orderIdText}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.orderSubInfoText}>{order.receiver_name} • {order.shipper?.full_name || 'Shipper'}</Text>
                </View>
                <Text style={styles.orderAmountText}>{Number(order.cod_amount).toLocaleString()}đ</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const totalSelectedCod = orders
    .filter(o => selectedIds.includes(o.id))
    .reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header màn hình */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Đối Soát Gom Nhóm</Text>
          <Text style={styles.headerSubtitle}>Theo dõi dòng tiền theo khách hàng</Text>
        </View>
      </View>

      <FlatList
        data={groupedData}
        renderItem={renderShopGroup}
        keyExtractor={(item) => item.shopId}
        contentContainerStyle={styles.listContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} colors={['#4F46E5']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark" size={80} color="#E2E8F0" />
            <Text style={styles.emptyText}>Hiện chưa có đơn hàng nào cần đối soát tài chính.</Text>
          </View>
        ) : <ActivityIndicator size="large" color="#4F46E5" style={{marginTop: 50}} />}
      />

      {/* Action Footer Bar - Hiển thị khi có ít nhất 1 đơn được chọn */}
      {selectedIds.length > 0 && (
        <View style={styles.actionFooter}>
          <View style={styles.footerInfoBox}>
            <Text style={styles.selectedCountLabel}>Đã chọn {selectedIds.length} đơn hàng</Text>
            <Text style={styles.totalAmountValue}>{totalSelectedCod.toLocaleString()}đ</Text>
          </View>
          <TouchableOpacity 
            style={[styles.batchSubmitBtn, processing && { opacity: 0.6 }]} 
            onPress={handleBatchReconcile}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.batchBtnText}>ĐỐI SOÁT NGAY</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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

  listContainer: { padding: 16, paddingBottom: 110 },
  
  shopGroupCard: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    marginBottom: 16, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  shopHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#fff' 
  },
  checkboxTouch: { padding: 4, marginRight: 14 },
  shopInfoSection: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopNameText: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  shopStatsText: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '600' },

  orderListContainer: { 
    backgroundColor: '#F9FAFB', 
    borderTopWidth: 1, 
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingBottom: 10
  },
  orderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  orderDetailTextContainer: { flex: 1, marginLeft: 16 },
  orderIdText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  orderSubInfoText: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '700' },
  orderAmountText: { fontSize: 15, fontWeight: '900', color: '#1E293B' },

  actionFooter: { 
    position: 'absolute', 
    bottom: 24, 
    left: 20, 
    right: 20, 
    backgroundColor: '#111827', 
    borderRadius: 28, 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 18,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 }
  },
  footerInfoBox: { flex: 1 },
  selectedCountLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  totalAmountValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  batchSubmitBtn: { 
    backgroundColor: '#4F46E5', 
    paddingHorizontal: 22, 
    paddingVertical: 14, 
    borderRadius: 18,
    elevation: 4
  },
  batchBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  emptyContainer: { alignItems: 'center', marginTop: 120, paddingHorizontal: 50 },
  emptyText: { textAlign: 'center', marginTop: 24, color: '#94A3B8', fontSize: 16, fontWeight: '600', lineHeight: 24 }
});