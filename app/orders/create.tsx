import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList, Switch 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
/**
 * SỬA LỖI: Đảm bảo các đường dẫn import chính xác với cấu trúc thư mục OMS/app/orders/
 * app/orders/create.tsx -> ../../ -> gốc dự án -> src/utils/
 */
import { supabase } from '../../src/utils/supabase';
import { calculateShippingFee } from '../../src/utils/feeCalculator';

// Hàm hỗ trợ tìm kiếm tiếng Việt không dấu
const removeVietnameseTones = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

/**
 * Màn hình Tạo Đơn hàng (Dành cho Customer)
 * Đã được tối ưu giao diện và fix các lỗi TypeScript/Style
 */
export default function CreateOrderScreen() {
  const router = useRouter();
  
  // Trạng thái tải dữ liệu
  const [loading, setLoading] = useState(false);
  const [initialFetching, setInitialFetching] = useState(true);

  // --- Dữ liệu danh mục ---
  const [pickupAddresses, setPickupAddresses] = useState<any[]>([]);
  const [provincesList, setProvincesList] = useState<any[]>([]);
  const [wardsList, setWardsList] = useState<any[]>([]);

  // --- States cho Form tạo đơn ---
  const [selectedPickupId, setSelectedPickupId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [provinceId, setProvinceId] = useState<string | number>('');
  const [wardId, setWardId] = useState<string | number>('');
  const [addressDetail, setAddressDetail] = useState('');
  const [orderContents, setOrderContents] = useState(''); 
  const [weightGram, setWeightGram] = useState('100'); 
  const [codAmount, setCodAmount] = useState('0');
  const [isReceiverPay, setIsReceiverPay] = useState(false);

  // --- States cho Modal ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'pickup' | 'province' | 'ward'>('pickup');
  const [searchQuery, setSearchQuery] = useState('');

  // --- States cho Phí vận chuyển ---
  const [baseFee, setBaseFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [totalShippingFee, setTotalShippingFee] = useState(0);

  const formatNumber = (val: string) => {
    if (!val) return '';
    const cleanVal = val.replace(/\D/g, '');
    return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getRawNumber = (val: string | number) => {
    if (typeof val === 'number') return val;
    return parseInt(val.toString().replace(/\./g, '')) || 0;
  };

  // 1. Tải dữ liệu danh mục khi vào màn hình
  useEffect(() => {
    const fetchData = async () => {
      try {
        setInitialFetching(true);
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return;

        const user = authData.user;

        // Tải địa chỉ lấy hàng và danh sách tỉnh thành
        const [addrRes, provRes] = await Promise.all([
          supabase.from('tb_addresses').select('*, tb_provinces:province_id(id, name, region)').eq('user_id', user.id),
          supabase.from('tb_provinces').select('*').order('name')
        ]);

        if (addrRes.data) {
          setPickupAddresses(addrRes.data);
          const def = addrRes.data.find(a => a.is_default);
          if (def) setSelectedPickupId(def.id);
        }
        if (provRes.data) setProvincesList(provRes.data);
      } catch (err: any) {
        console.error("Fetch Error:", err.message);
      } finally {
        setInitialFetching(false);
      }
    };
    fetchData();
  }, []);

  // Tải phường xã khi tỉnh thành thay đổi
  useEffect(() => {
    if (provinceId) {
      const fetchWards = async () => {
        const { data } = await supabase.from('tb_wards').select('*').eq('province_id', provinceId).order('name');
        if (data) setWardsList(data);
      };
      fetchWards();
    } else {
      setWardsList([]);
    }
  }, [provinceId]);

  // 2. Logic tự động tính phí vận chuyển
  useEffect(() => {
    const weight = getRawNumber(weightGram);
    const cod = getRawNumber(codAmount);
    
    const selectedPickup = pickupAddresses.find(a => a.id === selectedPickupId);
    const selectedReceiverProv = provincesList.find(p => p.id === parseInt(provinceId.toString()));

    if (selectedPickup && selectedReceiverProv && selectedPickup.tb_provinces) {
      const result = calculateShippingFee({
        pickupProvince: { id: selectedPickup.province_id, region: selectedPickup.tb_provinces.region },
        receiverProvince: { id: selectedReceiverProv.id, region: selectedReceiverProv.region },
        weight,
        codAmount: cod
      });

      setBaseFee(result.baseFee);
      setInsuranceFee(result.insuranceFee);
      setTotalShippingFee(result.totalFee);
    }
  }, [weightGram, codAmount, provinceId, selectedPickupId, pickupAddresses, provincesList]);

  const handleSelect = (item: any) => {
    if (modalType === 'pickup') setSelectedPickupId(item.id);
    else if (modalType === 'province') { setProvinceId(item.id); setWardId(''); }
    else setWardId(item.id);
    setModalVisible(false);
    setSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!selectedPickupId || !receiverName || !receiverPhone || !provinceId || !wardId || !addressDetail || !orderContents) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ thông tin bắt buộc (*)');
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vui lòng đăng nhập lại");

      const { error } = await supabase.from('tb_orders').insert([{
        user_id: user.id,
        pickup_address_id: selectedPickupId,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        receiver_province_id: parseInt(provinceId.toString()),
        receiver_ward_id: parseInt(wardId.toString()),
        receiver_address_detail: addressDetail,
        order_contents: orderContents,
        weight_gram: getRawNumber(weightGram),
        cod_amount: getRawNumber(codAmount),
        shipping_fee: totalShippingFee,
        is_receiver_pay: isReceiverPay,
        delivery_status: 'PENDING',
        financial_status: 'unpaid'
      }]);

      if (error) throw error;
      
      Alert.alert('Thành công', 'Đơn hàng của bạn đã được tạo.', [
        { text: 'Xong', onPress: () => router.replace('/(tabs)/orders' as any) }
      ]);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể tạo đơn: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialFetching) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={{ marginTop: 12, color: '#666', fontWeight: '600' }}>Đang chuẩn bị dữ liệu...</Text>
      </View>
    );
  }

  // --- Logic tính Tổng thu khách ---
  const codRaw = getRawNumber(codAmount);
  const totalReceiverPay = isReceiverPay ? (codRaw + totalShippingFee) : codRaw;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={26} color="#1E40AF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tạo Đơn Hàng Mới</Text>
          </View>

          {/* 1. ĐỊA CHỈ LẤY HÀNG */}
          <Text style={styles.sectionTitle}>1. Thông tin lấy hàng</Text>
          <TouchableOpacity style={styles.selector} onPress={() => { setModalType('pickup'); setModalVisible(true); }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedName}>{selectedPickupId ? pickupAddresses.find(a => a.id === selectedPickupId)?.contact_name : "Chọn kho lấy hàng *"}</Text>
              {selectedPickupId && <Text style={styles.selectedSub} numberOfLines={1}>{pickupAddresses.find(a => a.id === selectedPickupId)?.address_detail}</Text>}
            </View>
            <Ionicons name="location" size={22} color="#1E40AF" />
          </TouchableOpacity>

          {/* 2. THÔNG TIN NGƯỜI NHẬN */}
          <Text style={styles.sectionTitle}>2. Thông tin người nhận</Text>
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder="Tên người nhận *" value={receiverName} onChangeText={setReceiverName} placeholderTextColor="#94A3B8" />
            <TextInput style={styles.input} placeholder="Số điện thoại người nhận *" value={receiverPhone} onChangeText={setReceiverPhone} keyboardType="phone-pad" placeholderTextColor="#94A3B8" />
            <TouchableOpacity style={styles.selector} onPress={() => { setModalType('province'); setModalVisible(true); }}>
              <Text style={{ color: provinceId ? '#1E293B' : '#94A3B8', fontSize: 15, fontWeight: '500' }}>
                {provinceId ? provincesList.find(p => p.id === provinceId)?.name : "Tỉnh/Thành phố *"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.selector, !provinceId && { opacity: 0.5 }]} disabled={!provinceId} onPress={() => { setModalType('ward'); setModalVisible(true); }}>
              <Text style={{ color: wardId ? '#1E293B' : '#94A3B8', fontSize: 15, fontWeight: '500' }}>
                {wardId ? wardsList.find(w => w.id === wardId)?.name : "Phường/Xã *"}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TextInput style={styles.input} placeholder="Địa chỉ chi tiết *" value={addressDetail} onChangeText={setAddressDetail} placeholderTextColor="#94A3B8" />
          </View>

          {/* 3. CHI TIẾT GÓI HÀNG */}
          <Text style={styles.sectionTitle}>3. Thông tin hàng hóa</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Nội dung hàng hóa *</Text>
            <TextInput 
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
              placeholder="Ví dụ: Quần áo, Điện tử, Giày dép..." 
              value={orderContents} 
              onChangeText={setOrderContents} 
              multiline 
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.label}>Cân nặng (Gram)</Text>
                <TextInput style={[styles.input, styles.numberInput]} value={weightGram} onChangeText={(t) => setWeightGram(formatNumber(t))} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tiền COD (VNĐ)</Text>
                <TextInput style={[styles.input, styles.numberInput]} value={codAmount} onChangeText={(t) => setCodAmount(formatNumber(t))} keyboardType="numeric" />
              </View>
            </View>
          </View>

          {/* 4. HÌNH THỨC THANH TOÁN */}
          <Text style={styles.sectionTitle}>4. Hình thức thanh toán cước</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>{isReceiverPay ? 'Người nhận trả phí' : 'Người gửi trả phí'}</Text>
                <Text style={styles.switchSub}>{isReceiverPay ? 'Phí vận chuyển sẽ cộng vào tiền thu người nhận' : 'Phí vận chuyển sẽ trừ vào số dư của bạn'}</Text>
              </View>
              <Switch value={isReceiverPay} onValueChange={setIsReceiverPay} trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }} thumbColor={isReceiverPay ? '#1E40AF' : '#9CA3AF'} />
            </View>
          </View>

          {/* 5. TỔNG QUAN CHI PHÍ */}
          <View style={[styles.card, styles.feeCard]}>
            <View style={styles.feeRow}><Text style={styles.feeLabel}>Phí vận chuyển:</Text><Text style={styles.feeValue}>{totalShippingFee.toLocaleString()}đ</Text></View>
            <View style={styles.feeRow}><Text style={styles.feeLabel}>Tiền COD:</Text><Text style={styles.feeValue}>{codRaw.toLocaleString()}đ</Text></View>
            <View style={styles.divider} />
            <View style={styles.feeRow}>
              <Text style={styles.totalLabel}>TỔNG THU NGƯỜI NHẬN:</Text>
              <Text style={styles.totalValue}>{totalReceiverPay.toLocaleString()}đ</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.submitButton, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Xác nhận & Tạo Đơn</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Tìm kiếm Danh mục */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
                <TextInput style={styles.modalSearchInput} placeholder="Nhập từ khóa tìm nhanh..." value={searchQuery} onChangeText={setSearchQuery} autoFocus />
              </View>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSearchQuery(''); }}><Ionicons name="close-circle" size={32} color="#EF4444" /></TouchableOpacity>
            </View>
            <FlatList
              data={(modalType === 'pickup' ? pickupAddresses : (modalType === 'province' ? provincesList : wardsList)).filter(item => removeVietnameseTones(item.name || item.contact_name).includes(removeVietnameseTones(searchQuery)))}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemRow} onPress={() => handleSelect(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemText}>{item.name || item.contact_name}</Text>
                    {item.address_detail && <Text style={{fontSize: 12, color: '#64748B', marginTop: 4}} numberOfLines={1}>{item.address_detail}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
                </TouchableOpacity>
              )}
              // FIX: ListEmptyComponent returns null if false to avoid build error
              ListEmptyComponent={!loading ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                  <Text style={{ color: '#94A3B8', fontWeight: '500' }}>Không tìm thấy kết quả nào.</Text>
                </View>
              ) : null}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, marginTop: 10 },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1E40AF' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#334155', marginTop: 15, marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  label: { fontSize: 13, color: '#64748B', marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B', fontWeight: '500' },
  numberInput: { textAlign: 'right', fontWeight: '800', color: '#1E40AF', fontSize: 16 },
  row: { flexDirection: 'row' },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  selectedName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  selectedSub: { fontSize: 12, color: '#64748B', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  switchSub: { fontSize: 11, color: '#64748B', marginTop: 4, maxWidth: '85%', lineHeight: 16 },
  feeCard: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, marginTop: 15 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feeLabel: { color: '#475569', fontSize: 14, fontWeight: '600' },
  feeValue: { color: '#1E293B', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#BFDBFE', marginVertical: 12 },
  totalLabel: { fontWeight: '900', fontSize: 14, color: '#1E40AF' },
  totalValue: { fontWeight: '900', fontSize: 22, color: '#EF4444' },
  submitButton: { backgroundColor: '#10B981', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 30, elevation: 6, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', overflow: 'hidden', paddingHorizontal: 4 },
  modalHeader: { flexDirection: 'row', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 15, borderRadius: 14, marginRight: 15, height: 50 },
  modalSearchInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  itemText: { fontSize: 16, fontWeight: '600', color: '#1E293B' }
});