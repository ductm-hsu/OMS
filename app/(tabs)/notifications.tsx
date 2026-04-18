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
  Platform,
  Dimensions
} from 'react-native';
// Sử dụng thư viện icon chuẩn lucide cho môi trường Expo
import { 
  Bell, 
  Package, 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  CheckCheck,
  ChevronRight,
  Inbox
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
// Đảm bảo tệp supabase.js nằm trong src/utils/
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

/**
 * Cấu trúc dữ liệu thông báo dựa trên bảng tb_notifications thực tế:
 * id, created_at, user_id, title, content, order_id, is_read
 */
interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  content: string;
  order_id: string | null;
  is_read: boolean;
}

/**
 * MÀN HÌNH QUẢN LÝ THÔNG BÁO (TAB NOTIFICATIONS)
 * Hiển thị danh sách cập nhật đơn hàng và tin nhắn hệ thống.
 * Hỗ trợ điều hướng nhanh đến đơn hàng qua order_id.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Tải danh sách thông báo từ Database
  const fetchNotifications = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      setCurrentUserId(authData.user.id);

      const { data, error } = await supabase
        .from('tb_notifications')
        .select('*')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Lỗi tải thông báo:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 2. Đánh dấu tất cả là đã đọc
  const markAllAsRead = async () => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('tb_notifications')
        .update({ is_read: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Lỗi đánh dấu đã đọc:', e);
    }
  };

  // 3. Xử lý khi nhấn vào từng thông báo
  const handlePressNotification = async (item: Notification) => {
    try {
      // Nếu chưa đọc thì cập nhật trạng thái đã đọc trong DB
      if (!item.is_read) {
        await supabase.from('tb_notifications').update({ is_read: true }).eq('id', item.id);
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
      }

      // Nếu thông báo gắn với một đơn hàng cụ thể, điều hướng tới trang chi tiết
      if (item.order_id) {
        router.push(`/orders/${item.order_id}` as any);
      }
    } catch (e) {
      console.error('Lỗi xử lý nhấn thông báo:', e);
    }
  };

  // 4. Chọn Icon phù hợp dựa trên nội dung (Content)
  const getNotificationStyles = (content: string) => {
    const text = content ? content.toLowerCase() : '';
    if (text.includes('thành công') || text.includes('hoàn tất')) 
      return { icon: <CheckCircle size={22} color="#10B981" />, bg: '#D1FAE5' };
    if (text.includes('đang giao') || text.includes('vận chuyển')) 
      return { icon: <Truck size={22} color="#3B82F6" />, bg: '#DBEAFE' };
    if (text.includes('hủy')) 
      return { icon: <AlertCircle size={22} color="#EF4444" />, bg: '#FEE2E2' };
    return { icon: <Package size={22} color="#6366F1" />, bg: '#EEF2FF' };
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const styleInfo = getNotificationStyles(item.content);
    
    return (
      <TouchableOpacity 
        style={[styles.notiCard, !item.is_read && styles.unreadCard]}
        onPress={() => handlePressNotification(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: styleInfo.bg }]}>
          {styleInfo.icon}
        </View>
        <View style={styles.contentBox}>
          <View style={styles.titleRow}>
            <Text style={[styles.notiTitle, !item.is_read && styles.boldTitle]}>{item.title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notiContent} numberOfLines={2}>{item.content}</Text>
          <View style={styles.timeRow}>
            <Clock size={12} color="#94A3B8" />
            <Text style={styles.timeText}>
              {new Date(item.created_at).toLocaleString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit', 
                day: '2-digit', 
                month: '2-digit' 
              })}
            </Text>
            {item.order_id && (
              <Text style={styles.orderTag}>#{item.order_id.slice(0, 8).toUpperCase()}</Text>
            )}
          </View>
        </View>
        <ChevronRight size={16} color="#E2E8F0" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Thông Báo</Text>
          <Text style={styles.headerSub}>Tin tức và hành trình đơn hàng</Text>
        </View>
        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markReadBtn}>
            <CheckCheck size={18} color="#1E40AF" />
            <Text style={styles.markReadText}>Đọc hết</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} colors={['#1E40AF']} />
        }
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyCircle}>
              <Inbox size={50} color="#CBD5E0" />
            </View>
            <Text style={styles.emptyTitle}>Hộp thư trống</Text>
            <Text style={styles.emptyDesc}>Hiện tại bạn chưa có thông báo mới nào liên quan đến đơn hàng.</Text>
          </View>
        ) : <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 50 }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 18, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9',
    paddingTop: Platform.OS === 'ios' ? 10 : 25 
  },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  markReadText: { color: '#1E40AF', fontSize: 12, fontWeight: '800', marginLeft: 6 },

  listPadding: { padding: 16, paddingBottom: 100 },
  notiCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 22, 
    marginBottom: 12, 
    alignItems: 'center',
    borderWidth: 1, 
    borderColor: '#F1F5F9',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  unreadCard: { backgroundColor: '#F0F9FF', borderColor: '#BFDBFE', borderWidth: 1.5 },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  contentBox: { flex: 1, marginLeft: 15, marginRight: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  notiTitle: { fontSize: 15, fontWeight: '700', color: '#475569' },
  boldTitle: { fontWeight: '900', color: '#0F172A' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  notiContent: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 11, color: '#94A3B8', marginLeft: 4, fontWeight: '700' },
  orderTag: { marginLeft: 12, fontSize: 10, color: '#1E40AF', backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '800' },

  emptyBox: { alignItems: 'center', marginTop: 120, paddingHorizontal: 40 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
  emptyDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 10, lineHeight: 22, fontWeight: '500' }
});