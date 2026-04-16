import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList, Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/utils/supabase';
import { calculateShippingFee } from '../../src/utils/feeCalculator';

// Hàm hỗ trợ tìm kiếm tiếng Việt không dấu
const nonAccentVietnamese = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  // Trạng thái tải dữ liệu
  const [initialFetching, setInitialFetching] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // --- Dữ liệu danh mục ---
  const [provincesList, setProvincesList] = useState<any[]>([]);
  const [wardsList, setWardsList] = useState<any[]>([]);
  const [pickupAddresses, setPickupAddresses] = useState<any[]>([]);

  // --- States dữ liệu đơn hàng ---
  const [order, setOrder] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    receiver_name: '',
    receiver_phone: '',
    receiver_province_id: null,
    receiver_ward_id: null,
    receiver_address_detail: '',
    order_contents: '', // Thêm mục nội dung hàng hóa
    weight_gram: '0',
    cod_amount: '0',
    shipping_fee: 0,
    pickup_address_id: '',
    is_receiver_pay: false 
  });

  // --- Modal States ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'province' | 'ward' | 'pickup'>('province');
  const [searchQuery, setSearchQuery] = useState('');

  const formatNumber = (val: string | number) => {
    if (!val) return '0';
    const cleanVal = val.toString().replace(/\D/g, '');
    return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getRawNumber = (val: string | number) => {
    if (typeof val === 'number') return val;
    return parseInt(val.replace(/\./g, '')) || 0;
  };

  useEffect(() => {
    if (id) fetchInitialData();
    else setInitialFetching(false);
  }, [id]);

  const fetchInitialData = async () => {
    try {
      setInitialFetching(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Thông báo', 'Phiên đăng nhập hết hạn.');
        return;
      }

      // 1. Tải danh mục đồng thời
      const [provRes, addrRes] = await Promise.all([
        supabase.from('tb_provinces').select('*').order('name'),
        supabase.from('tb_addresses').select('*, tb_provinces:province_id(id, name, region)').eq('user_id', authData.user.id)
      ]);

      if (provRes.data) setProvincesList(provRes.data);
      if (addrRes.data) setPickupAddresses(addrRes.data);

      // 2. Tải chi tiết đơn hàng
      const { data: orderData, error: orderError } = await supabase
        .from('tb_orders')
        .select(`*`)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;

      if (orderData) {
        setOrder(orderData);
        setFormData({
          receiver_name: orderData.receiver_name || '',
          receiver_phone: orderData.receiver_phone || '',
          receiver_province_id: orderData.receiver_province_id,
          receiver_ward_id: orderData.receiver_ward_id,
          receiver_address_detail: orderData.receiver_address_detail || '',
          order_contents: orderData.order_contents || '', // Gán nội dung hàng hóa
          weight_gram: formatNumber(orderData.weight_gram || 0),
          cod_amount: formatNumber(orderData.cod_amount || 0),
          shipping_fee: orderData.shipping_fee || 0,
          pickup_address_id: orderData.pickup_address_id || '',
          is_receiver_pay: orderData.is_receiver_pay ?? false
        });
        
        if (orderData.receiver_province_id) {
          const { data: wardData } = await supabase.from('tb_wards').select('*').eq('province_id', orderData.receiver_province_id).order('name');
          if (wardData) setWardsList(wardData);
        }
      }
    } catch (error: any) {
      console.error('Fetch Error:', error.message);
      Alert.alert('Lỗi', 'Không thể tải chi tiết đơn hàng.');
    } finally {
      setInitialFetching(false);
    }
  };

  // Tính lại phí khi người dùng thay đổi thông tin trong chế độ sửa
  useEffect(() => {
    if (!isEditing) return;
    const weight = getRawNumber(formData.weight_gram);
    const cod = getRawNumber(formData.cod_amount);
    const selectedPickup = pickupAddresses.find(a => a.id === formData.pickup_address_id);
    const selectedReceiverProv = provincesList.find(p => p.id === formData.receiver_province_id);

    if (selectedPickup && selectedReceiverProv && selectedPickup.tb_provinces) {
      const result = calculateShippingFee({
        pickupProvince: { id: selectedPickup.province_id, region: selectedPickup.tb_provinces.region },
        receiverProvince: { id: selectedReceiverProv.id, region: selectedReceiverProv.region },
        weight,
        codAmount: cod
      });
      setFormData((prev: any) => ({ ...prev, shipping_fee: result.totalFee }));
    }
  }, [formData.weight_gram, formData.cod_amount, formData.receiver_province_id, formData.pickup_address_id, isEditing]);

  const handleUpdate = async () => {
    if (!formData.receiver_name || !formData.receiver_phone || !formData.receiver_province_id || !formData.order_contents) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tb_orders')
        .update({
          receiver_name: formData.receiver_name,
          receiver_phone: formData.receiver_phone,
          receiver_province_id: formData.receiver_province_id,
          receiver_ward_id: formData.receiver_ward_id,
          receiver_address_detail: formData.receiver_address_detail,
          order_contents: formData.order_contents, // Cập nhật nội dung hàng hóa
          weight_gram: getRawNumber(formData.weight_gram),
          cod_amount: getRawNumber(formData.cod_amount),
          shipping_fee: formData.shipping_fee,
          pickup_address_id: formData.pickup_address_id,
          is_receiver_pay: formData.is_receiver_pay
        })
        .eq('id', id);

      if (error) throw error;
      
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('tb_order_tracking').insert([{
        order_id: id,
        status: order?.delivery_status,
        note: 'Cập nhật thông tin đơn hàng.',
        updated_by: authData?.user?.id
      }]);

      Alert.alert('Thành công', 'Đơn hàng đã được cập nhật.');
      setIsEditing(false);
      fetchInitialData();
    } catch (error: any) {
      Alert.alert('Lỗi', 'Cập nhật thất bại: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING': return { text: 'Chờ xử lý', color: '#F59E0B' };
      case 'SHIPPING': return { text: 'Đang giao', color: '#3B82F6' };
      case 'CANCELLED': return { text: 'Đã hủy', color: '#EF4444' };
      case 'DELIVERED': return { text: 'Thành công', color: '#10B981' };
      default: return { text: status || 'N/A', color: '#6B7280' };
    }
  };

  const filteredModalData = () => {
    const query = nonAccentVietnamese(searchQuery);
    let data: any[] = [];
    if (modalType === 'province') data = provincesList;
    else if (modalType === 'ward') data = wardsList;
    else data = pickupAddresses;

    return data.filter(item => {
      const name = item.name || item.contact_name || '';
      return nonAccentVietnamese(name).includes(query);
    });
  };

  const handleSelectItem = (item: any) => {
    if (modalType === 'province') {
      setFormData({ ...formData, receiver_province_id: item.id, receiver_ward_id: null });
      supabase.from('tb_wards').select('*').eq('province_id', item.id).order('name').then(({ data }) => setWardsList(data || []));
    } else if (modalType === 'pickup') {
      setFormData({ ...formData, pickup_address_id: item.id });
    } else {
      setFormData({ ...formData, receiver_ward_id: item.id });
    }
    setModalVisible(false);
    setSearchQuery('');
  };

  if (initialFetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0056b3" />
        <Text style={{ marginTop: 12, color: '#666' }}>Đang tải...</Text>
      </View>
    );
  }

  const codRaw = getRawNumber(formData.cod_amount);
  const totalReceiverPay = formData.is_receiver_pay ? (codRaw + formData.shipping_fee) : codRaw;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#0056b3" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Đơn hàng #{order?.id.slice(0,8)}</Text>
        <TouchableOpacity 
          onPress={() => isEditing ? handleUpdate() : setIsEditing(true)} 
          disabled={updating || (order?.delivery_status !== 'PENDING' && !isEditing)}
        >
          {updating ? <ActivityIndicator size="small" color="#0056b3" /> : (
            <Text style={[styles.editBtnText, (order?.delivery_status !== 'PENDING' && !isEditing) && { opacity: 0.3 }]}>
              {isEditing ? 'Lưu' : 'Sửa'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.statusBanner}>
          <Text style={styles.statusLabel}>Trạng thái: </Text>
          <Text style={[styles.statusValue, { color: getStatusLabel(order?.delivery_status).color }]}>
            {getStatusLabel(order?.delivery_status).text}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>1. Nội dung & Gói hàng</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Nội dung hàng hóa *</Text>
          <TextInput 
            style={[styles.input, !isEditing && styles.disabledText, { height: 80, textAlignVertical: 'top' }]} 
            editable={isEditing} 
            placeholder="Mô tả hàng hóa..." 
            value={formData.order_contents} 
            onChangeText={t => setFormData({...formData, order_contents: t})} 
            multiline
          />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Trọng lượng (Gram)</Text>
              <TextInput 
                style={[styles.input, !isEditing && styles.disabledText, styles.numberInput]} 
                editable={isEditing} 
                value={formData.weight_gram} 
                onChangeText={t => setFormData({...formData, weight_gram: formatNumber(t)})} 
                keyboardType="numeric" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tiền COD (VNĐ)</Text>
              <TextInput 
                style={[styles.input, !isEditing && styles.disabledText, styles.numberInput]} 
                editable={isEditing} 
                value={formData.cod_amount} 
                onChangeText={t => setFormData({...formData, cod_amount: formatNumber(t)})} 
                keyboardType="numeric" 
              />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>2. Thông tin lấy & giao hàng</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Kho lấy hàng</Text>
          <TouchableOpacity 
            style={[styles.selector, !isEditing && styles.disabledInput]} 
            disabled={!isEditing} 
            onPress={() => { setModalType('pickup'); setModalVisible(true); }}
          >
            <Text style={styles.selectedText}>
              {pickupAddresses.find(a => a.id === formData.pickup_address_id)?.contact_name || 'Chọn kho'}
            </Text>
            {isEditing && <Ionicons name="chevron-down" size={16} color="#999" />}
          </TouchableOpacity>
          
          <Text style={styles.label}>Người nhận</Text>
          <TextInput style={[styles.input, !isEditing && styles.disabledText]} editable={isEditing} placeholder="Họ tên người nhận" value={formData.receiver_name} onChangeText={t => setFormData({...formData, receiver_name: t})} />
          <TextInput style={[styles.input, !isEditing && styles.disabledText]} editable={isEditing} placeholder="Số điện thoại" value={formData.receiver_phone} onChangeText={t => setFormData({...formData, receiver_phone: t})} keyboardType="phone-pad" />
          
          <Text style={styles.label}>Khu vực nhận</Text>
          <TouchableOpacity 
            style={[styles.selector, !isEditing && styles.disabledInput]} 
            disabled={!isEditing} 
            onPress={() => { setModalType('province'); setModalVisible(true); }}
          >
            <Text style={styles.selectedText}>{provincesList.find(p => p.id === formData.receiver_province_id)?.name || 'Tỉnh/Thành phố'}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.selector, (!isEditing || !formData.receiver_province_id) && styles.disabledInput]} 
            disabled={!isEditing || !formData.receiver_province_id} 
            onPress={() => { setModalType('ward'); setModalVisible(true); }}
          >
            <Text style={styles.selectedText}>{wardsList.find(w => w.id === formData.receiver_ward_id)?.name || 'Phường/Xã'}</Text>
          </TouchableOpacity>

          <TextInput style={[styles.input, !isEditing && styles.disabledText]} editable={isEditing} placeholder="Địa chỉ chi tiết" value={formData.receiver_address_detail} onChangeText={t => setFormData({...formData, receiver_address_detail: t})} />
        </View>

        <Text style={styles.sectionTitle}>3. Thanh toán</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentLabel}>{formData.is_receiver_pay ? 'Người nhận trả phí' : 'Người gửi trả phí'}</Text>
              <Text style={styles.paymentSub}>
                {formData.is_receiver_pay ? 'Cước vận chuyển cộng vào tiền thu người nhận' : 'Người gửi thanh toán cước vận chuyển'}
              </Text>
            </View>
            <Switch 
              disabled={!isEditing} 
              value={formData.is_receiver_pay} 
              onValueChange={(val) => setFormData({ ...formData, is_receiver_pay: val })} 
              trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
              thumbColor={formData.is_receiver_pay ? '#3B82F6' : '#9CA3AF'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Phí vận chuyển:</Text>
            <Text style={styles.feeValue}>{formData.shipping_fee.toLocaleString()}đ</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.totalLabel}>TỔNG THU KHÁCH:</Text>
            <Text style={styles.totalValue}>{totalReceiverPay.toLocaleString()}đ</Text>
          </View>
        </View>

        {isEditing && (
          <TouchableOpacity style={styles.cancelEditBtn} onPress={() => { setIsEditing(false); fetchInitialData(); }}>
            <Text style={styles.cancelEditText}>Hủy chỉnh sửa</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal tìm kiếm dùng chung cho Province/Ward/Pickup */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#999" style={{ marginRight: 10 }} />
                <TextInput 
                  style={styles.modalSearchInput} 
                  placeholder="Nhập từ khóa tìm kiếm..." 
                  value={searchQuery} 
                  onChangeText={setSearchQuery} 
                  autoFocus 
                />
              </View>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSearchQuery(''); }}>
                <Ionicons name="close-circle" size={32} color="#d9534f" />
              </TouchableOpacity>
            </View>
            <FlatList 
              data={filteredModalData()} 
              keyExtractor={(item) => item.id.toString()} 
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemRow} onPress={() => handleSelectItem(item)}>
                  <Text style={styles.itemText}>{item.name || item.contact_name}</Text>
                  {item.address_detail && <Text style={styles.itemSubText}>{item.address_detail}</Text>}
                </TouchableOpacity>
              )} 
              ListEmptyComponent={<View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#999' }}>Không tìm thấy kết quả</Text></View>}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 50, 
    paddingBottom: 15, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6' 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  editBtnText: { fontSize: 16, fontWeight: 'bold', color: '#0056b3' },
  statusBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 14, 
    borderRadius: 12, 
    marginBottom: 20, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  statusLabel: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  statusValue: { fontSize: 15, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginTop: 10, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  input: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 8, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#dee2e6', color: '#1F2937' },
  disabledText: { color: '#6B7280' },
  disabledInput: { backgroundColor: '#e9ecef', borderColor: '#ced4da' },
  numberInput: { textAlign: 'right', fontWeight: 'bold', color: '#0056b3' },
  row: { flexDirection: 'row' },
  selector: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#f8f9fa', 
    padding: 12, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#dee2e6', 
    marginBottom: 12 
  },
  selectedText: { color: '#1F2937', fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  paymentSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  feeLabel: { color: '#4B5563', fontSize: 14 },
  feeValue: { color: '#1F2937', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  totalLabel: { fontWeight: 'bold', color: '#0056b3', fontSize: 14 },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#EF4444' },
  cancelEditBtn: { marginTop: 15, padding: 10, alignItems: 'center' },
  cancelEditText: { color: '#6B7280', fontSize: 15, textDecorationLine: 'underline' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f5', borderRadius: 10, paddingHorizontal: 12, marginRight: 10 },
  modalSearchInput: { flex: 1, paddingVertical: 10, fontSize: 16 },
  itemRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f8f9fa' },
  itemText: { fontSize: 16, color: '#111827' },
  itemSubText: { fontSize: 12, color: '#999', marginTop: 2 }
});