import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView, 
  Platform, 
  FlatList,
  Dimensions
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Sửa lỗi đường dẫn import supabase để đảm bảo tính nhất quán
import { supabase } from '../../src/utils/supabase';

const { width } = Dimensions.get('window');

type ConfigTab = 'pricing' | 'zones' | 'promos';

/**
 * Màn hình Cấu hình Hệ thống (Dành cho Manager)
 * Phân tách 3 Tab: Bảng giá, Phân vùng, Khuyến mãi
 */
export default function App() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ConfigTab>('pricing');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- States cho Bảng giá vận chuyển ---
  const [pricing, setPricing] = useState({
    intra_province_base: '15000',
    intra_province_step: '2000',
    intra_region_base: '25000',
    intra_region_step: '5000',
    inter_region_base: '35000',
    inter_region_step: '10000',
    insurance_threshold: '1000000',
    insurance_percent: '1'
  });

  // --- States cho Khu vực (Tỉnh thành) ---
  const [provinces, setProvinces] = useState<any[]>([]);
  const [searchProvince, setSearchProvince] = useState('');

  useEffect(() => {
    if (activeTab === 'zones') fetchProvinces();
  }, [activeTab]);

  const fetchProvinces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('tb_provinces').select('*').order('name');
      if (error) throw error;
      setProvinces(data || []);
    } catch (e) {
      console.error('Lỗi tải tỉnh thành:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateProvinceRegion = async (id: number, newRegion: string) => {
    try {
      const { error } = await supabase
        .from('tb_provinces')
        .update({ region: newRegion })
        .eq('id', id);
      if (error) throw error;
      setProvinces(prev => prev.map(p => p.id === id ? { ...p, region: newRegion } : p));
    } catch (e) { 
      Alert.alert('Lỗi', 'Không thể cập nhật vùng miền cho tỉnh này.'); 
    }
  };

  const handleSavePricing = () => {
    setSaving(true);
    // Logic thực tế sẽ lưu vào bảng cấu hình trong Database
    setTimeout(() => {
      setSaving(false);
      Alert.alert('Thành công', 'Biểu phí mới đã được áp dụng toàn hệ thống.');
    }, 1000);
  };

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Ionicons name="pricetags" size={18} color="#4F46E5" />
        <Text style={styles.sectionTitle}>BIỂU PHÍ CƠ BẢN (500G ĐẦU)</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Nội tỉnh (Cùng tỉnh)</Text>
          <TextInput style={styles.input} value={pricing.intra_province_base} keyboardType="numeric" onChangeText={t => setPricing({...pricing, intra_province_base: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Nội vùng (Bắc-Bắc...)</Text>
          <TextInput style={styles.input} value={pricing.intra_region_base} keyboardType="numeric" onChangeText={t => setPricing({...pricing, intra_region_base: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Liên vùng (Bắc-Nam...)</Text>
          <TextInput style={styles.input} value={pricing.inter_region_base} keyboardType="numeric" onChangeText={t => setPricing({...pricing, inter_region_base: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Ionicons name="stats-chart" size={18} color="#4F46E5" />
        <Text style={styles.sectionTitle}>CƯỚC CỘNG THÊM (MỖI 500G TIẾP)</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Nội tỉnh (+)</Text>
          <TextInput style={styles.input} value={pricing.intra_province_step} keyboardType="numeric" onChangeText={t => setPricing({...pricing, intra_province_step: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Nội vùng (+)</Text>
          <TextInput style={styles.input} value={pricing.intra_region_step} keyboardType="numeric" onChangeText={t => setPricing({...pricing, intra_region_step: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Liên vùng (+)</Text>
          <TextInput style={styles.input} value={pricing.inter_region_step} keyboardType="numeric" onChangeText={t => setPricing({...pricing, inter_region_step: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Ionicons name="shield-checkmark" size={18} color="#059669" />
        <Text style={styles.sectionTitle}>PHÍ BẢO HIỂM COD</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Ngưỡng tính phí bảo hiểm</Text>
          <TextInput style={styles.input} value={pricing.insurance_threshold} keyboardType="numeric" onChangeText={t => setPricing({...pricing, insurance_threshold: t})} />
          <Text style={styles.unit}>đ</Text>
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Phí bảo hiểm (%)</Text>
          <TextInput style={styles.input} value={pricing.insurance_percent} keyboardType="numeric" onChangeText={t => setPricing({...pricing, insurance_percent: t})} />
          <Text style={styles.unit}>%</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSavePricing} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>CẬP NHẬT BIỂU PHÍ</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderZonesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput 
          style={styles.searchInput} 
          placeholder="Tìm tỉnh thành để phân vùng..." 
          value={searchProvince} 
          onChangeText={setSearchProvince} 
          placeholderTextColor="#94A3B8"
        />
      </View>
      
      {loading ? <ActivityIndicator style={{marginTop: 50}} color="#4F46E5" /> : (
        <FlatList
          data={provinces.filter(p => p.name.toLowerCase().includes(searchProvince.toLowerCase()))}
          keyExtractor={item => item.id.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.provinceRow}>
              <Text style={styles.provinceName}>{item.name}</Text>
              <View style={styles.regionPicker}>
                {['bac', 'trung', 'nam'].map(r => (
                  <TouchableOpacity 
                    key={r} 
                    style={[styles.regionChip, item.region === r && styles.regionChipActive]}
                    onPress={() => updateProvinceRegion(item.id, r)}
                  >
                    <Text style={[styles.regionText, item.region === r && styles.regionTextActive]}>
                      {r === 'bac' ? 'Bắc' : (r === 'trung' ? 'Trung' : 'Nam')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderPromosTab = () => (
    <View style={[styles.tabContent, styles.centered]}>
      <MaterialCommunityIcons name="gift-outline" size={80} color="#E2E8F0" />
      <Text style={styles.placeholderTitle}>Chương trình khuyến mãi</Text>
      <Text style={styles.placeholderDesc}>Đây là tính năng ý tưởng cho tương lai, giúp Manager thiết lập các chương trình đồng giá hoặc giảm phí ship.</Text>
      <TouchableOpacity style={styles.ideaBtn}>
        <Text style={styles.ideaBtnText}>GHI NHẬN Ý TƯỞNG</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Cấu hình Hệ thống</Text>
          <Text style={styles.headerSubtitle}>Thiết lập biểu phí vận chuyển</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'pricing' && styles.tabActive]} onPress={() => setActiveTab('pricing')}>
          <Text style={[styles.tabLabel, activeTab === 'pricing' && styles.tabLabelActive]}>Bảng giá</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'zones' && styles.tabActive]} onPress={() => setActiveTab('zones')}>
          <Text style={[styles.tabLabel, activeTab === 'zones' && styles.tabLabelActive]}>Phân vùng</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'promos' && styles.tabActive]} onPress={() => setActiveTab('promos')}>
          <Text style={[styles.tabLabel, activeTab === 'promos' && styles.tabLabelActive]}>Khuyến mãi</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'pricing' && renderPricingTab()}
        {activeTab === 'zones' && renderZonesTab()}
        {activeTab === 'promos' && renderPromosTab()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9', 
    paddingTop: Platform.OS === 'ios' ? 10 : 25 
  },
  backBtn: { padding: 4, marginRight: 15 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  headerSubtitle: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  tabItem: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#4F46E5' },
  tabLabel: { fontSize: 13, fontWeight: '800', color: '#94A3B8' },
  tabLabelActive: { color: '#4F46E5' },

  tabContent: { flex: 1, padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12, marginLeft: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#64748B', marginLeft: 10, letterSpacing: 1.2 },
  
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  inputLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#475569' },
  input: { width: 110, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, textAlign: 'right', fontWeight: '900', color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  unit: { marginLeft: 12, fontSize: 13, fontWeight: '800', color: '#94A3B8', width: 25 },
  
  saveBtn: { backgroundColor: '#4F46E5', borderRadius: 20, padding: 18, alignItems: 'center', marginTop: 35, elevation: 6, shadowColor: '#4F46E5', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, height: 52, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  provinceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 10, justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOpacity: 0.02 },
  provinceName: { fontSize: 15, fontWeight: '800', color: '#334155' },
  regionPicker: { flexDirection: 'row', gap: 8 },
  regionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9' },
  regionChipActive: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#4F46E5' },
  regionText: { fontSize: 11, fontWeight: '900', color: '#94A3B8' },
  regionTextActive: { color: '#4F46E5' },

  centered: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 30 },
  placeholderTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginTop: 25 },
  placeholderDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 12, lineHeight: 22, fontWeight: '500' },
  ideaBtn: { marginTop: 35, paddingHorizontal: 25, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  ideaBtnText: { fontSize: 12, fontWeight: '900', color: '#64748B' }
});