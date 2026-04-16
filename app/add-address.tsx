import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, ScrollView, Modal, FlatList, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/utils/supabase';

export default function AddAddressScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // States dữ liệu
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [wardId, setWardId] = useState<number | null>(null);
  const [addressDetail, setAddressDetail] = useState('');

  // States hành chính
  const [provinces, setProvinces] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  
  // States Modal Tìm kiếm
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'province' | 'ward'>('province');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    const { data } = await supabase.from('tb_provinces').select('*').order('name');
    if (data) setProvinces(data);
  };

  const fetchWards = async (pId: number) => {
    const { data } = await supabase.from('tb_wards').select('*').eq('province_id', pId).order('name');
    if (data) setWards(data);
  };

  const handleSelectProvince = (item: any) => {
    setProvinceId(item.id);
    setWardId(null);
    fetchWards(item.id);
    setModalVisible(false);
    setSearchQuery('');
  };

    // Hàm loại bỏ dấu tiếng Việt
    const nonAccentVietnamese = (str: string) => {
    if (!str) return "";
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
    };

    // Áp dụng vào phần lọc dữ liệu (Filter)
    const filteredData = (modalType === 'province' ? provinces : wards).filter(item => {
    const nameUnsigned = nonAccentVietnamese(item.name);
    const queryUnsigned = nonAccentVietnamese(searchQuery);
    return nameUnsigned.includes(queryUnsigned);
    });

  const handleSave = async () => {
    if (!contactName || !contactPhone || !provinceId || !wardId || !addressDetail) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tb_addresses').insert([{
      user_id: user?.id,
      contact_name: contactName,
      contact_phone: contactPhone,
      province_id: provinceId,
      ward_id: wardId,
      address_detail: addressDetail
    }]);
    setLoading(false);
    if (!error) router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 60 }}>
        <Text style={styles.headerTitle}>Thêm Kho Mới</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Tên kho/Người liên hệ *</Text>
          <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="VD: Kho chính" />

          <Text style={styles.label}>Số điện thoại *</Text>
          <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />

          <Text style={styles.label}>Tỉnh/Thành phố *</Text>
          <TouchableOpacity style={styles.selector} onPress={() => { setModalType('province'); setModalVisible(true); }}>
            <Text style={{ color: provinceId ? '#333' : '#999' }}>
              {provinceId ? provinces.find(p => p.id === provinceId)?.name : "Bấm để tìm Tỉnh/Thành"}
            </Text>
            <Ionicons name="search" size={20} color="#0056b3" />
          </TouchableOpacity>

          <Text style={styles.label}>Phường/Xã *</Text>
          <TouchableOpacity 
            style={[styles.selector, !provinceId && { opacity: 0.5 }]} 
            disabled={!provinceId}
            onPress={() => { setModalType('ward'); setModalVisible(true); }}
          >
            <Text style={{ color: wardId ? '#333' : '#999' }}>
              {wardId ? wards.find(w => w.id === wardId)?.name : "Bấm để tìm Phường/Xã"}
            </Text>
            <Ionicons name="search" size={20} color="#0056b3" />
          </TouchableOpacity>

          <Text style={styles.label}>Địa chỉ chi tiết *</Text>
          <TextInput style={styles.input} value={addressDetail} onChangeText={setAddressDetail} placeholder="Số nhà, tên đường..." />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Lưu Kho Hàng</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Tìm Kiếm Thông Minh */}
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
                <Ionicons name="close-circle" size={30} color="#d9534f" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredData}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.itemRow} 
                  onPress={() => modalType === 'province' ? handleSelectProvince(item) : (setWardId(item.id), setModalVisible(false))}
                >
                  <Text style={styles.itemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0056b3', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 3 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#555', marginTop: 15, marginBottom: 8 },
  input: { backgroundColor: '#f1f3f5', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef' },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f3f5', padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef' },
  saveBtn: { backgroundColor: '#28a745', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  saveText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, height: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalSearchInput: { flex: 1, backgroundColor: '#f1f3f5', padding: 12, borderRadius: 8, marginRight: 10, fontSize: 16 },
  itemRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f8f9fa' },
  itemText: { fontSize: 16, color: '#333' }
});