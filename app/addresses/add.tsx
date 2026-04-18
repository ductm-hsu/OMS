import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  ScrollView, 
  Modal, 
  FlatList, 
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
/**
 * Đảm bảo đường dẫn import supabase chính xác:
 * Tệp hiện tại: app/addresses/add.tsx
 * Đường dẫn: nhảy ra 2 cấp (../../) để về gốc, sau đó vào src/utils/supabase
 */
import { supabase } from '../../src/utils/supabase';

/**
 * MÀN HÌNH THÊM / SỬA KHO HÀNG (app/addresses/add.tsx)
 * - Tự động phát hiện chế độ "Sửa" nếu có tham số 'id' trong URL.
 * - Sử dụng giao diện Navy hiện đại đồng bộ với hệ thống OMS.
 */
export default function App() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Lấy ID từ params để xác định chế độ Thêm mới hay Chỉnh sửa
  const id = params?.id;
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  // States dữ liệu form
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [wardId, setWardId] = useState<number | null>(null);
  const [addressDetail, setAddressDetail] = useState('');

  // States danh mục hành chính
  const [provinces, setProvinces] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  
  // States Modal tìm kiếm
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'province' | 'ward'>('province');
  const [searchQuery, setSearchQuery] = useState('');

  // Khởi tạo dữ liệu khi màn hình mount
  useEffect(() => {
    const initData = async () => {
      await fetchProvinces();

      if (id) {
        await fetchCurrentAddress(id.toString());
      } else {
        setFetching(false);
      }
    };
    
    initData();
  }, [id]);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase.from('tb_provinces').select('*').order('name');
      if (error) throw error;
      if (data) setProvinces(data);
    } catch (e: any) { 
      console.error('Lỗi khi tải danh sách tỉnh thành:', e.message); 
    }
  };

  const fetchWards = async (pId: number) => {
    try {
      const { data, error } = await supabase.from('tb_wards').select('*').eq('province_id', pId).order('name');
      if (error) throw error;
      if (data) setWards(data);
    } catch (e: any) { 
      console.error('Lỗi khi tải danh sách phường xã:', e.message); 
    }
  };

  // Tải dữ liệu chi tiết của kho hàng cũ để chỉnh sửa
  const fetchCurrentAddress = async (addressId: string) => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('tb_addresses')
        .select('*')
        .eq('id', addressId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setContactName(data.contact_name || '');
        setContactPhone(data.contact_phone || '');
        setProvinceId(data.province_id);
        setWardId(data.ward_id);
        setAddressDetail(data.address_detail || '');
        
        if (data.province_id) {
          await fetchWards(data.province_id);
        }
      } else {
        Alert.alert("Thông báo", "Không tìm thấy thông tin kho hàng.");
      }
    } catch (e: any) {
      Alert.alert("Lỗi", "Không thể tải dữ liệu kho hàng: " + e.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSelectProvince = (item: any) => {
    setProvinceId(item.id);
    setWardId(null);
    fetchWards(item.id);
    setModalVisible(false);
    setSearchQuery('');
  };

  const handleSave = async () => {
    if (!contactName || !contactPhone || !provinceId || !wardId || !addressDetail) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ các trường bắt buộc (*).');
      return;
    }

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Phiên đăng nhập hết hạn.");

      const payload = {
        user_id: authData.user.id,
        contact_name: contactName,
        contact_phone: contactPhone,
        province_id: provinceId,
        ward_id: wardId,
        address_detail: addressDetail
      };

      if (isEditing && id) {
        // CẬP NHẬT ĐỊA CHỈ HIỆN TẠI
        const { error } = await supabase
          .from('tb_addresses')
          .update(payload)
          .eq('id', id.toString());
        if (error) throw error;
        Alert.alert("Thành công", "Đã cập nhật thông tin kho hàng.");
      } else {
        // THÊM MỚI ĐỊA CHỈ
        const { error } = await supabase
          .from('tb_addresses')
          .insert([payload]);
        if (error) throw error;
        Alert.alert("Thành công", "Đã thêm kho hàng mới.");
      }
      
      router.back();
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể lưu dữ liệu: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Đang tải thông tin kho...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={26} color="#1E40AF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? "Sửa Kho Hàng" : "Thêm Kho Mới"}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Tên kho / Người liên hệ *</Text>
            <TextInput 
              style={styles.input} 
              value={contactName} 
              onChangeText={setContactName} 
              placeholder="Ví dụ: Kho Quận 1" 
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Số điện thoại liên hệ *</Text>
            <TextInput 
              style={styles.input} 
              value={contactPhone} 
              onChangeText={setContactPhone} 
              keyboardType="phone-pad" 
              placeholder="09xx xxx xxx" 
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Tỉnh / Thành phố *</Text>
            <TouchableOpacity style={styles.selector} onPress={() => { setModalType('province'); setModalVisible(true); }}>
              <Text style={{ color: provinceId ? '#1E293B' : '#94A3B8', fontSize: 15, fontWeight: '500' }}>
                {provinceId ? provinces.find(p => p.id === provinceId)?.name : "Bấm để chọn Tỉnh/Thành"}
              </Text>
              <Ionicons name="search" size={20} color="#1E40AF" />
            </TouchableOpacity>

            <Text style={styles.label}>Phường / Xã *</Text>
            <TouchableOpacity 
              style={[styles.selector, !provinceId && { opacity: 0.5, backgroundColor: '#F1F5F9' }]} 
              disabled={!provinceId}
              onPress={() => { setModalType('ward'); setModalVisible(true); }}
            >
              <Text style={{ color: wardId ? '#1E293B' : '#94A3B8', fontSize: 15, fontWeight: '500' }}>
                {wardId ? wards.find(w => w.id === wardId)?.name : "Bấm để chọn Phường/Xã"}
              </Text>
              <Ionicons name="search" size={20} color="#1E40AF" />
            </TouchableOpacity>

            <Text style={styles.label}>Địa chỉ chi tiết *</Text>
            <TextInput 
              style={styles.input} 
              value={addressDetail} 
              onChangeText={setAddressDetail} 
              placeholder="Số nhà, tên đường..." 
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSave} 
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>{isEditing ? "CẬP NHẬT THÔNG TIN" : "LƯU KHO HÀNG"}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal tìm kiếm danh mục hành chính */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TextInput 
                style={styles.modalSearchInput} 
                placeholder="Nhập từ khóa tìm kiếm..." 
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setModalVisible(false); setSearchQuery(''); }}>
                <Ionicons name="close-circle" size={32} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={(modalType === 'province' ? provinces : wards).filter(item => (item.name||'').toLowerCase().includes(searchQuery.toLowerCase()))}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.itemRow} 
                  onPress={() => modalType === 'province' ? handleSelectProvince(item) : (setWardId(item.id), setModalVisible(false))}
                >
                  <Text style={styles.itemText}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#CBD5E0" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1E40AF' },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    padding: 20, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4 }
  },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 15, marginBottom: 8 },
  input: { 
    backgroundColor: '#F8FAFC', 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    fontSize: 15, 
    color: '#1E293B', 
    fontWeight: '500' 
  },
  selector: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    padding: 14, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  saveBtn: { 
    backgroundColor: '#10B981', 
    padding: 18, 
    borderRadius: 18, 
    alignItems: 'center', 
    marginTop: 35, 
    elevation: 6, 
    shadowColor: '#10B981', 
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 }
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, height: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalSearchInput: { flex: 1, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 12, marginRight: 10, fontSize: 16, color: '#1E293B' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  itemText: { fontSize: 16, color: '#1E293B', fontWeight: '600' }
});