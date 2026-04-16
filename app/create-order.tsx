import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, 
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Image, Modal, FlatList 
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/utils/supabase';
import { calculateShippingFee } from '../src/utils/feeCalculator';

// Hàm hỗ trợ tìm kiếm tiếng Việt không dấu để lọc dữ liệu tỉnh/phường
const nonAccentVietnamese = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export default function CreateOrderScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // --- States dữ liệu từ Database ---
  const [pickupAddresses, setPickupAddresses] = useState<any[]>([]);
  const [provincesList, setProvincesList] = useState<any[]>([]);
  const [wardsList, setWardsList] = useState<any[]>([]);

  // --- States cho Form ---
  const [selectedPickupId, setSelectedPickupId] = useState<string>('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [wardId, setWardId] = useState<number | null>(null);
  const [addressDetail, setAddressDetail] = useState('');
  const [weightGram, setWeightGram] = useState('100'); 
  const [codAmount, setCodAmount] = useState('0');
  const [image, setImage] = useState<string | null>(null);

  // --- States Modal Tìm kiếm ---
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'pickup' | 'province' | 'ward'>('pickup');
  const [searchQuery, setSearchQuery] = useState('');

  // --- States cho Phí ---
  const [baseFee, setBaseFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [totalShippingFee, setTotalShippingFee] = useState(0);

  // Định dạng số hiển thị (VD: 1.000.000)
  const formatNumber = (val: string) => {
    if (!val) return '';
    const cleanVal = val.replace(/\D/g, '');
    return cleanVal.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Lấy số nguyên thuần túy từ chuỗi định dạng
  const getRawNumber = (val: string | number) => {
    if (typeof val === 'number') return val;
    return parseInt(val.toString().replace(/\./g, '')) || 0;
  };

  // 1. Fetch dữ liệu khởi tạo
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Lấy địa chỉ lấy hàng và JOIN với tb_provinces để lấy region
        const { data: addr, error: addrError } = await supabase
          .from('tb_addresses')
          .select('*, tb_provinces:province_id(id, name, region)')
          .eq('user_id', user.id);
        
        if (addrError) throw addrError;
        
        if (addr) {
          setPickupAddresses(addr);
          const def = addr.find(a => a.is_default);
          if (def) setSelectedPickupId(def.id);
        }

        // Lấy danh sách tỉnh thành
        const { data: prov, error: provError } = await supabase
          .from('tb_provinces')
          .select('*')
          .order('name');
        
        if (provError) throw provError;
        if (prov) setProvincesList(prov);
      } catch (err: any) {
        console.error('Lỗi khởi tạo:', err.message);
      }
    };
    fetchData();
  }, []);

  // Fetch phường xã khi tỉnh thành thay đổi
  useEffect(() => {
    if (provinceId) {
      const fetchWards = async () => {
        const { data, error } = await supabase
          .from('tb_wards')
          .select('*')
          .eq('province_id', provinceId)
          .order('name');
        
        if (error) return;
        if (data) setWardsList(data);
      };
      fetchWards();
    } else {
      setWardsList([]);
    }
  }, [provinceId]);

  // 2. Logic tìm kiếm trong Modal
  const filteredData = () => {
    const query = nonAccentVietnamese(searchQuery);
    let data: any[] = [];
    if (modalType === 'pickup') data = pickupAddresses;
    else if (modalType === 'province') data = provincesList;
    else data = wardsList;

    return data.filter(item => {
      const target = item.name || item.contact_name || '';
      return nonAccentVietnamese(target).includes(query);
    });
  };

  const handleSelect = (item: any) => {
    if (modalType === 'pickup') {
      setSelectedPickupId(item.id);
    } else if (modalType === 'province') { 
      setProvinceId(item.id); 
      setWardId(null); 
    } else {
      setWardId(item.id);
    }
    setModalVisible(false);
    setSearchQuery('');
  };

  // 3. Tính phí tự động khi có thay đổi thông tin liên quan
  useEffect(() => {
    const weight = getRawNumber(weightGram);
    const cod = getRawNumber(codAmount);
    
    const selectedPickup = pickupAddresses.find(a => a.id === selectedPickupId);
    const selectedReceiverProv = provincesList.find(p => p.id === provinceId);

    if (selectedPickup && selectedReceiverProv && selectedPickup.tb_provinces) {
      const result = calculateShippingFee({
        pickupProvince: { 
          id: selectedPickup.province_id, 
          region: selectedPickup.tb_provinces.region 
        },
        receiverProvince: { 
          id: selectedReceiverProv.id, 
          region: selectedReceiverProv.region 
        },
        weight: weight,
        codAmount: cod
      });

      setBaseFee(result.baseFee);
      setInsuranceFee(result.insuranceFee);
      setTotalShippingFee(result.totalFee);
    } else {
      setBaseFee(0);
      setInsuranceFee(0);
      setTotalShippingFee(0);
    }
  }, [weightGram, codAmount, provinceId, selectedPickupId, pickupAddresses, provincesList]);

  // Chọn ảnh gói hàng
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  // 4. XỬ LÝ LƯU ĐƠN HÀNG VÀO DATABASE
  const handleSubmit = async () => {
    if (!selectedPickupId || !receiverName || !receiverPhone || !provinceId || !wardId || !addressDetail) {
      Alert.alert('Thông báo', 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Vui lòng đăng nhập lại.');

      // Chuẩn bị dữ liệu theo Schema tb_orders
      const orderData = {
        user_id: user.id,
        pickup_address_id: selectedPickupId,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        receiver_province_id: provinceId,
        receiver_ward_id: wardId,
        receiver_address_detail: addressDetail,
        weight_gram: getRawNumber(weightGram),
        cod_amount: getRawNumber(codAmount),
        shipping_fee: totalShippingFee,
        delivery_status: 'PENDING',
        financial_status: 'unpaid'
      };

      // Thêm vào bảng tb_orders
      const { data: newOrder, error: orderError } = await supabase
        .from('tb_orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;
      
      // Thêm lịch sử theo dõi đơn hàng vào tb_order_tracking
      if (newOrder) {
        const { error: trackingError } = await supabase
          .from('tb_order_tracking')
          .insert([{
            order_id: newOrder.id,
            status: 'PENDING',
            note: 'Đơn hàng mới đã được khởi tạo thành công.',
            updated_by: user.id
          }]);
        
        if (trackingError) console.error('Lỗi tạo tracking:', trackingError.message);
      }

      Alert.alert('Thành công', 'Đơn hàng đã được tạo và đang chờ xử lý.', [
        { text: 'Xem danh sách đơn', onPress: () => router.push('/(tabs)/orders') }
      ]);

    } catch (err: any) {
      console.error('Lỗi Submit:', err.message);
      Alert.alert('Lỗi', 'Không thể tạo đơn hàng. Chi tiết: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={64}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#0056b3" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tạo Đơn Giao Mới</Text>
        </View>

        {/* PHẦN 1: KHO LẤY HÀNG */}
        <Text style={styles.sectionTitle}>1. Thông tin lấy hàng</Text>
        <TouchableOpacity 
          style={styles.selector} 
          onPress={() => { setModalType('pickup'); setModalVisible(true); }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>
              {selectedPickupId 
                ? pickupAddresses.find(a => a.id === selectedPickupId)?.contact_name 
                : "Chọn kho lấy hàng *"}
            </Text>
            {selectedPickupId && (
              <Text style={styles.selectedSub} numberOfLines={1}>
                {pickupAddresses.find(a => a.id === selectedPickupId)?.address_detail}
              </Text>
            )}
          </View>
          <Ionicons name="business" size={22} color="#0056b3" />
        </TouchableOpacity>

        {/* PHẦN 2: NGƯỜI NHẬN */}
        <Text style={styles.sectionTitle}>2. Thông tin người nhận</Text>
        <View style={styles.card}>
          <TextInput 
            style={styles.input} 
            placeholder="Họ tên người nhận *" 
            value={receiverName} 
            onChangeText={setReceiverName} 
          />
          <TextInput 
            style={styles.input} 
            placeholder="Số điện thoại *" 
            value={receiverPhone} 
            onChangeText={setReceiverPhone} 
            keyboardType="phone-pad" 
          />
          
          <TouchableOpacity 
            style={styles.selector} 
            onPress={() => { setModalType('province'); setModalVisible(true); }}
          >
            <Text style={{ color: provinceId ? '#333' : '#999' }}>
              {provinceId 
                ? provincesList.find(p => p.id === provinceId)?.name 
                : "Tỉnh/Thành phố *"}
            </Text>
            <Ionicons name="search" size={18} color="#8e8e93" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.selector, !provinceId && { opacity: 0.5 }]} 
            disabled={!provinceId} 
            onPress={() => { setModalType('ward'); setModalVisible(true); }}
          >
            <Text style={{ color: wardId ? '#333' : '#999' }}>
              {wardId 
                ? wardsList.find(w => w.id === wardId)?.name 
                : "Phường/Xã *"}
            </Text>
            <Ionicons name="search" size={18} color="#8e8e93" />
          </TouchableOpacity>
          
          <TextInput 
            style={styles.input} 
            placeholder="Địa chỉ chi tiết (Số nhà, tên đường) *" 
            value={addressDetail} 
            onChangeText={setAddressDetail} 
          />
        </View>

        {/* PHẦN 3: CHI TIẾT GÓI HÀNG */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Chi tiết gói hàng</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Trọng lượng (Gram) *</Text>
              <TextInput 
                style={[styles.input, styles.numberInput]} 
                value={weightGram} 
                onChangeText={(t) => setWeightGram(formatNumber(t))} 
                keyboardType="numeric" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tiền COD (VNĐ) *</Text>
              <TextInput 
                style={[styles.input, styles.numberInput]} 
                value={codAmount} 
                onChangeText={(t) => setCodAmount(formatNumber(t))} 
                keyboardType="numeric" 
              />
            </View>
          </View>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={30} color="#8e8e93" />
                <Text style={styles.imageText}>Chụp ảnh gói hàng (Không bắt buộc)</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* PHẦN 4: TỔNG QUAN PHÍ */}
        <View style={[styles.card, styles.feeCard]}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Cước vận chuyển cơ bản:</Text>
            <Text style={styles.feeValue}>{baseFee.toLocaleString()}đ</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Phí bảo hiểm hàng hóa:</Text>
            <Text style={styles.feeValue}>{insuranceFee.toLocaleString()}đ</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.feeRow}>
            <Text style={styles.totalLabel}>TỔNG CỘNG:</Text>
            <Text style={styles.totalValue}>{totalShippingFee.toLocaleString()}đ</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, loading && { opacity: 0.7 }]} 
          onPress={handleSubmit} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Xác nhận & Lên Đơn</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL LỰA CHỌN TÌM KIẾM */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#8e8e93" style={{ marginRight: 10 }} />
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
              data={filteredData()}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemRow} onPress={() => handleSelect(item)}>
                  <Text style={styles.itemText}>{item.name || item.contact_name}</Text>
                  {(item.address_detail) && (
                    <Text style={styles.itemSubText} numberOfLines={1}>
                      {item.address_detail}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptySearch}>
                  <Text style={{ color: '#999' }}>Không tìm thấy kết quả phù hợp</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f4f6f8', padding: 16, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0056b3', marginLeft: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  label: { fontSize: 13, color: '#666', marginBottom: 5 },
  input: { backgroundColor: '#f1f3f5', padding: 13, borderRadius: 8, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e9ecef' },
  numberInput: { textAlign: 'right', fontWeight: 'bold', color: '#0056b3' },
  row: { flexDirection: 'row' },
  selector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f3f5', padding: 13, borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef', marginBottom: 12 },
  selectedName: { fontSize: 15, fontWeight: '600', color: '#333' },
  selectedSub: { fontSize: 12, color: '#888' },
  imagePicker: { height: 100, backgroundColor: '#f1f3f5', borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  imagePlaceholder: { alignItems: 'center' },
  imageText: { color: '#8e8e93', fontSize: 12, marginTop: 4 },
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  feeCard: { backgroundColor: '#eef6ff', borderColor: '#cfe2ff', borderWidth: 1, marginTop: 15 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feeLabel: { color: '#555', fontSize: 14 },
  feeValue: { color: '#333', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#d0d7de', marginVertical: 10 },
  totalLabel: { fontWeight: 'bold', fontSize: 16, color: '#0056b3' },
  totalValue: { fontWeight: 'bold', fontSize: 19, color: '#d9534f' },
  submitButton: { backgroundColor: '#28a745', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 25, marginBottom: 40 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f5', paddingHorizontal: 12, borderRadius: 10, marginRight: 10, height: 45 },
  modalSearchInput: { flex: 1, fontSize: 16 },
  itemRow: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#f8f9fa' },
  itemText: { fontSize: 16, fontWeight: '500' },
  itemSubText: { fontSize: 12, color: '#888' },
  emptySearch: { padding: 40, alignItems: 'center' }
});