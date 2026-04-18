import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  Platform,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// Sử dụng SafeAreaView từ thư viện context để tối ưu hiển thị và tránh warning deprecated
import { SafeAreaView } from 'react-native-safe-area-context';
/**
 * SỬA LỖI: Đảm bảo đường dẫn import supabase chính xác với cấu trúc thư mục mới
 * app/addresses/index.tsx -> ../../ -> gốc dự án -> src/utils/supabase
 */
import { supabase } from '../../src/utils/supabase';

/**
 * Màn hình Quản lý Kho hàng (Địa chỉ lấy hàng)
 * - Đã fix lỗi TypeScript: ListEmptyComponent trả về null thay vì false khi đang tải.
 * - Tối ưu SafeAreaView cho các thiết bị đời mới.
 */
export default function AddressManagerScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Hàm lấy danh sách địa chỉ từ bảng tb_addresses
  const fetchAddresses = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { data, error } = await supabase
        .from('tb_addresses')
        .select('*')
        .eq('user_id', authData.user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể tải danh sách kho hàng: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAddresses();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.storeName} numberOfLines={1}>{item.contact_name}</Text>
          {item.is_default ? (
            <View style={styles.tagWrapper}>
              <Text style={styles.defaultTag}>Mặc định</Text>
            </View>
          ) : null}
        </View>
      </View>
      
      <Text style={styles.phoneText}>{item.contact_phone}</Text>
      <Text style={styles.addressText} numberOfLines={2}>{item.address_detail}</Text>
      
      <View style={styles.actionRow}>
        {/* Nút Sửa */}
        <TouchableOpacity style={styles.iconBtn} onPress={() => {/* Logic sửa đơn */}}>
          <Ionicons name="create-outline" size={20} color="#1E40AF" />
          <Text style={styles.btnText}>Sửa</Text>
        </TouchableOpacity>

        {/* Nút Xóa */}
        <TouchableOpacity style={[styles.iconBtn, { marginLeft: 15 }]} onPress={() => {/* Logic xóa đơn */}}>
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={[styles.btnText, { color: '#EF4444' }]}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý Kho hàng</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Đang tải danh sách kho...</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listPadding}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E40AF']} />
          }
          /**
           * SỬA LỖI: Trả về null thay vì false khi loading để không báo lỗi Type definition
           */
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={80} color="#E2E8F0" />
              <Text style={styles.emptyText}>Bạn chưa có kho lấy hàng nào.</Text>
              <Text style={styles.emptySubText}>Vui lòng thêm kho mới để bắt đầu tạo đơn hàng.</Text>
            </View>
          ) : null}
          renderItem={renderItem}
        />
      )}

      {/* Nút thêm mới kho hàng */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => router.push('/addresses/add')}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>Thêm Kho Mới</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    paddingVertical: 15, 
    paddingHorizontal: 16, 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  
  listPadding: { padding: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#1E293B', fontSize: 16, fontWeight: '800' },
  emptySubText: { textAlign: 'center', marginTop: 8, color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 12, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  storeName: { fontSize: 17, fontWeight: '800', color: '#1E40AF', marginRight: 10, maxWidth: '70%' },
  tagWrapper: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  defaultTag: { color: '#1E40AF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  phoneText: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 6 },
  addressText: { fontSize: 14, color: '#64748B', lineHeight: 20, fontWeight: '500' },
  
  actionRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'center', 
    marginTop: 15, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F8FAFC' 
  },
  iconBtn: { 
    flexDirection: 'row', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  btnText: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginLeft: 6 },
  
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    flexDirection: 'row', 
    backgroundColor: '#1E40AF', 
    paddingHorizontal: 20, 
    paddingVertical: 14, 
    borderRadius: 30, 
    alignItems: 'center', 
    elevation: 8, 
    shadowColor: '#1E40AF', 
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 }
  },
  fabText: { color: '#ffffff', fontWeight: '900', fontSize: 15, marginLeft: 8, letterSpacing: 0.5 },
});