import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// Import Supabase - đường dẫn tương ứng với cấu trúc thư mục của bạn
import { supabase } from '../../../src/utils/supabase';

const { width } = Dimensions.get('window');

interface TrackingEvent {
  id: string;
  status: string;
  note: string;
  created_at: string;
}

export default function App() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [trackingData, setTrackingData] = useState<TrackingEvent[]>([]);
  const [orderInfo, setOrderInfo] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchTrackingData();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      // 1. Lấy thông tin cơ bản của đơn hàng
      const { data: order, error: orderError } = await supabase
        .from('tb_orders')
        .select('id, delivery_status, receiver_name, order_contents')
        .eq('id', id)
        .single();
      
      if (orderError) throw orderError;
      setOrderInfo(order);

      // 2. Lấy hành trình chi tiết từ bảng tb_order_tracking
      const { data: tracking, error: trackingError } = await supabase
        .from('tb_order_tracking')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false });

      if (trackingError) throw trackingError;
      setTrackingData(tracking || []);
    } catch (error: any) {
      console.error('Lỗi tải dữ liệu hành trình:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': 
        return { label: 'Chờ xử lý', color: '#F59E0B', icon: 'time-outline' as const };
      case 'SHIPPING': 
        return { label: 'Đang giao hàng', color: '#3B82F6', icon: 'bicycle-outline' as const };
      case 'DELIVERED': 
        return { label: 'Giao thành công', color: '#10B981', icon: 'checkmark-circle-outline' as const };
      case 'CANCELLED': 
        return { label: 'Đã hủy đơn', color: '#EF4444', icon: 'close-circle-outline' as const };
      default: 
        return { label: status || 'Hệ thống', color: '#6B7280', icon: 'radio-button-on-outline' as const };
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (!orderInfo && !loading) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={60} color="#D1D5DB" />
        <Text style={styles.emptyStateText}>Không tìm thấy thông tin đơn hàng này.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Hành trình vận chuyển</Text>
          <Text style={styles.headerSubtitle}>Mã đơn: #{id?.toString().slice(0, 8)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Thẻ tóm tắt */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="person" size={16} color="#4F46E5" />
            </View>
            <Text style={styles.summaryText}>Người nhận: <Text style={styles.boldText}>{orderInfo?.receiver_name}</Text></Text>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="cube" size={16} color="#4F46E5" />
            </View>
            <Text style={styles.summaryText}>Hàng hóa: <Text style={styles.boldText}>{orderInfo?.order_contents || 'Chưa cập nhật'}</Text></Text>
          </View>

          <View style={[styles.summaryRow, { marginBottom: 0 }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="stats-chart" size={16} color="#4F46E5" />
            </View>
            <Text style={styles.summaryText}>Trạng thái: <Text style={[styles.boldText, { color: getStatusDisplay(orderInfo?.delivery_status).color }]}>{getStatusDisplay(orderInfo?.delivery_status).label}</Text></Text>
          </View>
        </View>

        {/* Lịch sử lộ trình */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>Chi tiết quá trình</Text>
          {trackingData.length > 0 ? (
            trackingData.map((event, index) => {
              const statusInfo = getStatusDisplay(event.status);
              const isFirst = index === 0;
              const isLast = index === trackingData.length - 1;

              return (
                <View key={event.id} style={styles.timelineItem}>
                  <View style={styles.leftColumn}>
                    <View style={[styles.dot, { backgroundColor: isFirst ? statusInfo.color : '#D1D5DB' }]}>
                      {isFirst && <View style={styles.dotPulse} />}
                    </View>
                    {!isLast && <View style={styles.line} />}
                  </View>

                  <View style={styles.rightColumn}>
                    <View style={styles.eventHeader}>
                      <Text style={[styles.statusText, isFirst && { color: statusInfo.color, fontWeight: '800' }]}>
                        {statusInfo.label}
                      </Text>
                      <Text style={styles.timeText}>
                        {new Date(event.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {new Date(event.created_at).toLocaleDateString('vi-VN')}
                    </Text>
                    {event.note ? (
                      <View style={styles.noteBox}>
                        <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" style={{ marginRight: 6 }} />
                        <Text style={styles.noteText}>{event.note}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>Chưa ghi nhận lịch sử cho đơn hàng này.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingTop: 50,
  },
  backBtn: {
    marginRight: 16,
    padding: 4,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#111827',
  },
  timelineContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    minHeight: 400,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 90,
  },
  leftColumn: {
    alignItems: 'center',
    marginRight: 16,
    width: 20,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotPulse: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    position: 'absolute',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  rightColumn: {
    flex: 1,
    paddingBottom: 24,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  noteBox: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  noteText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyStateText: {
    marginTop: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginTop: 24,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '700',
  }
});