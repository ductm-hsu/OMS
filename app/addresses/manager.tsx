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
import { SafeAreaView } from 'react-native-safe-area-context';
/**
 * Đảm bảo đường dẫn import chính xác tới file cấu hình Supabase của bạn
 */
import { supabase } from '../../src/utils/supabase';

/**
 * MÀN HÌNH QUẢN LÝ KHO HÀNG (app/addresses/manager.tsx)
 * - Đã bổ sung logic debug chuyên sâu để kiểm tra tại sao thông tin không load được.
 * - Sửa lỗi điều hướng nút Sửa để đảm bảo params được truyền đúng chuẩn Expo Router.
 */
export default function App() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Theo dõi trạng thái đăng nhập và lấy ID người dùng
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Lỗi lấy session:', sessionError.message);
        }

        if (session?.user) {          
          setUserId(session.user.id);
        } else {          
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (user) {            
            setUserId(user.id);
          } else {
            console.warn('Không tìm thấy thông tin đăng nhập.');
            setLoading(false);
          }
          if (userError) console.error('Lỗi getUser:', userError.message);
        }
      } catch (e) {
        console.error("Lỗi ngoại lệ khi check auth:", e);
        setLoading(false);
      }
    };

    checkUser();

    // Lắng nghe thay đổi trạng thái đăng nhập (để xử lý kịp thời khi session hết hạn hoặc login lại)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
        setAddresses([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Hàm tải danh sách địa chỉ từ Supabase
  const fetchAddresses = useCallback(async (currentId: string) => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data, error } = await supabase
        .from('tb_addresses')
        .select('*')
        .eq('user_id', currentId)
        .order('is_default', { ascending: false });

      if (error) {
        console.error('Lỗi truy vấn database:', error.message);
        throw error;
      }
      
      setAddresses(data || []);
    } catch (error: any) {
      Alert.alert('Lỗi tải dữ liệu', 'Vui lòng kiểm tra kết nối mạng: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  // 3. Tự động fetch khi userId đã sẵn sàng
  useEffect(() => {
    if (userId) {
      fetchAddresses(userId);
    }
  }, [userId, fetchAddresses]);

  const onRefresh = () => {
    if (userId) {
      setRefreshing(true);
      fetchAddresses(userId);
    } else {
      Alert.alert("Thông báo", "Bạn cần đăng nhập để thực hiện tác vụ này.");
    }
  };

  // --- HÀM XỬ LÝ CHUYỂN TRANG SỬA (KÈM DEBUG) ---
  const handleEditAddress = (item: any) => {
    
    // Sử dụng route object đầy đủ để tránh lỗi Unmatched Route
    router.push({
      pathname: '/addresses/add',
      params: { id: item.id }
    } as any);
  };

  // --- LOGIC XÓA KHO HÀNG ---
  const handleDelete = (id: string) => {
    Alert.alert(
      "Xác nhận xóa",
      "Hành động này sẽ xóa vĩnh viễn kho hàng. Bạn có chắc chắn không?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Đồng ý xóa", 
          style: "destructive", 
          onPress: async () => {
            try {
              const { error } = await supabase.from('tb_addresses').delete().eq('id', id);
              if (error) throw error;
              setAddresses(prev => prev.filter(item => item.id !== id));
            } catch (e: any) {
              Alert.alert("Lỗi", "Không thể xóa: " + e.message);
            }
          } 
        }
      ]
    );
  };

  const handleSetDefault = async (id: string) => {
    if (!userId) return;
    try {
      await supabase.from('tb_addresses').update({ is_default: false }).eq('user_id', userId);
      const { error } = await supabase.from('tb_addresses').update({ is_default: true }).eq('id', id);
      if (error) throw error;
      fetchAddresses(userId);
    } catch (e) {
      Alert.alert("Lỗi", "Cập nhật mặc định thất bại.");
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.storeName} numberOfLines={1}>{item.contact_name}</Text>
          {item.is_default ? (
            <View style={styles.tagWrapper}><Text style={styles.defaultTag}>MẶC ĐỊNH</Text></View>
          ) : (
            <TouchableOpacity onPress={() => handleSetDefault(item.id)}>
              <Text style={styles.setDefaultLink}>Đặt làm mặc định</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <View style={styles.infoRow}>
        <Ionicons name="call-outline" size={15} color="#475569" />
        <Text style={styles.phoneText}>{item.contact_phone}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={15} color="#475569" />
        <Text style={styles.addressText} numberOfLines={2}>{item.address_detail}</Text>
      </View>
      
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.iconBtn} 
          onPress={() => handleEditAddress(item)}
        >
          <Ionicons name="create-outline" size={18} color="#1E40AF" />
          <Text style={styles.btnText}>Sửa</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.iconBtn, { marginLeft: 15, borderColor: '#FEE2E2' }]} 
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={[styles.btnText, { color: '#EF4444' }]}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý Kho hàng</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={styles.loadingText}>Đang tải dữ liệu từ hệ thống...</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E40AF']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={80} color="#CBD5E0" />
              <Text style={styles.emptyText}>Chưa có thông tin kho nào</Text>
              <Text style={styles.emptySub}>Dữ liệu kho của bạn sẽ xuất hiện tại đây.</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Bấm để tải lại trang</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8} 
        onPress={() => router.push('/addresses/add' as any)}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>Thêm Kho Mới</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 15, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  listContainer: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storeName: { fontSize: 18, fontWeight: '800', color: '#1E40AF', maxWidth: '60%' },
  tagWrapper: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  defaultTag: { color: '#1E40AF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  setDefaultLink: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  phoneText: { fontSize: 15, fontWeight: '600', color: '#475569', marginLeft: 8 },
  addressText: { fontSize: 14, color: '#64748B', marginLeft: 8, lineHeight: 20, fontWeight: '500' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  iconBtn: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  btnText: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginLeft: 8 },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600', fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { textAlign: 'center', marginTop: 16, color: '#1E293B', fontSize: 18, fontWeight: '800' },
  emptySub: { textAlign: 'center', marginTop: 8, color: '#94A3B8', fontSize: 14, paddingHorizontal: 40 },
  retryBtn: { marginTop: 20, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 12 },
  retryText: { color: '#1E40AF', fontWeight: '700' },
  fab: { position: 'absolute', bottom: 30, right: 20, flexDirection: 'row', backgroundColor: '#1E40AF', paddingHorizontal: 22, paddingVertical: 16, borderRadius: 35, alignItems: 'center', elevation: 8, shadowColor: '#1E40AF', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15, marginLeft: 10, letterSpacing: 0.5 },
});