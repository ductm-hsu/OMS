import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// Sử dụng SafeAreaView từ thư viện chuẩn để tối ưu hiển thị trên các thiết bị di động
import { SafeAreaView } from 'react-native-safe-area-context';
/**
 * SỬA LỖI: Đảm bảo đường dẫn import supabase chính xác với cấu trúc:
 * app/addresses/add.tsx -> ../../ -> gốc -> src/utils/supabase
 */
import { supabase } from '../../src/utils/supabase';

/**
 * Màn hình Thêm Kho Hàng Mới
 * Đã sửa lỗi: Bổ sung KeyboardAvoidingView để không bị che khuất bởi bàn phím
 * Đã sửa lỗi: Xử lý kiểu dữ liệu cho ListEmptyComponent
 */
export default function AddAddressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase.from('tb_provinces').select('*').order('name');
      if (error) throw error;
      if (data) setProvinces(data);
    } catch (e: any) {
      console.error("Lỗi tải tỉnh thành:", e.message);
    }
  };

  const fetchWards = async (pId: number) => {
    try {
      const { data, error } = await supabase.from('tb_wards').select('*').eq('province_id', pId).order('name');
      if (error) throw error;
      if (data) setWards(data);
    } catch (e: any) {
      console.error("Lỗi tải phường xã:", e.message);
    }
  };

  const handleSelectProvince = (item: any) => {
    setProvinceId(item.id);
    setWardId(null);
    fetchWards(item.id);
    setModalVisible(false);
    setSearchQuery('');
  };

  const nonAccentVietnamese = (str: string) => {
    if (!str) return "";
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
  };

  const filteredData = (modalType === 'province' ? provinces : wards).filter(item => {
    return nonAccentVietnamese(item.name).includes(nonAccentVietnamese(searchQuery));
  });

  const handleSave = async () => {
    if (!contactName || !contactPhone || !provinceId || !wardId || !addressDetail) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ các trường có dấu (*).');
      return;
    }

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error("Phiên đăng nhập hết hạn.");

      const { error } = await supabase.from('tb_addresses').insert([{
        user_id: authData.user.id,
        contact_name: contactName,
        contact_phone: contactPhone,
        province_id: provinceId,
        ward_id: wardId,
        address_detail: addressDetail,
        is_default: false // Mặc định không phải kho chính, người dùng có thể đổi sau
      }]);

      if (error) throw error;
      
      Alert.alert('Thành công', 'Kho hàng mới đã được lưu vào hệ thống.');
      router.back();
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể lưu kho hàng: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={26} color="#1E40AF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Thêm Kho Mới</Text>
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
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>LƯU KHO HÀNG</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Tìm kiếm Tỉnh/Thành & Phường/Xã */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput 
                  style={styles.modalSearchInput} 
                  placeholder="Nhập từ khóa tìm kiếm..." 
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              </View>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSearchQuery(''); }}>
                <Ionicons name="close-circle" size={32} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredData}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 40 }}
              /**
               * SỬA LỖI: Trả về null thay vì false khi danh sách trống hoặc đang xử lý
               */
              ListEmptyComponent={searchQuery !== '' ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ color: '#94A3B8', fontWeight: '500' }}>Không tìm thấy kết quả.</Text>
                </View>
              ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1E40AF' },
  
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 18, 
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
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBarContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F1F5F9', 
    paddingHorizontal: 15, 
    borderRadius: 14, 
    marginRight: 15, 
    height: 50 
  },
  modalSearchInput: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '500', color: '#1E293B' },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F8FAFC' 
  },
  itemText: { fontSize: 16, color: '#1E293B', fontWeight: '600' }
});