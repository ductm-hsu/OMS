import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  TextInput,
  Modal,
  SafeAreaView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Đảm bảo tệp supabase.js tồn tại trong src/utils/
import { supabase } from '../../src/utils/supabase';

interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  role: string | null;
}

/**
 * Màn hình Profile (app/(tabs)/profile.tsx)
 * Quản lý thông tin cá nhân và phân quyền các lối tắt tính năng
 * Đặc biệt hỗ trợ các lối tắt quản trị dành cho role 'manager'
 */
export default function App() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data, error } = await supabase
          .from('tb_users')
          .select('id, full_name, phone_number, email, role')
          .eq('id', authData.user.id)
          .single();

        if (error) throw error;
        if (data) {
          setProfile(data);
          setEditName(data.full_name || '');
          setEditPhone(data.phone_number || '');
        }
      }
    } catch (error: any) {
      console.error('Lỗi tải hồ sơ:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Thông báo', 'Họ tên không được để trống.');
      return;
    }
    try {
      setSaving(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { error } = await supabase
          .from('tb_users')
          .update({ full_name: editName, phone_number: editPhone })
          .eq('id', authData.user.id);
        if (error) throw error;
        setProfile(prev => prev ? { ...prev, full_name: editName, phone_number: editPhone } : null);
        setIsEditModalVisible(false);
        Alert.alert('Thành công', 'Thông tin đã được cập nhật.');
      }
    } catch (error: any) { 
      Alert.alert('Lỗi', error.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Xác nhận thoát hệ thống?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Thoát', style: 'destructive', onPress: async () => {
          try {
            await supabase.auth.signOut();
            await AsyncStorage.removeItem('userRole');
            router.replace('/' as any); 
          } catch (e) { console.log(e); }
      }}
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  const role = profile?.role;
  const isShipper = role === 'shipper';
  const isManager = role === 'manager';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Cá Nhân</Text></View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Card thông tin cơ bản */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name={isManager ? "shield-checkmark" : "person"} size={32} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile?.full_name || 'Hội viên OMS'}</Text>
            <Text style={styles.userEmail}>{profile?.email}</Text>
            <View style={[styles.roleBadge, isManager && { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.roleText, isManager && { color: '#B91C1C' }]}>
                {role?.toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editBtnCircle} onPress={() => setIsEditModalVisible(true)}>
            <Ionicons name="pencil" size={16} color="#1E40AF" />
          </TouchableOpacity>
        </View>

        {/* PHẦN DÀNH CHO MANAGER (QUẢN TRỊ VIÊN) */}
        {isManager && (
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>QUẢN TRỊ HỆ THỐNG</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/manager/users' as any)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FDF2F8' }]}>
                  <Ionicons name="people" size={20} color="#BE185D" />
                </View>
                <Text style={styles.menuItemText}>Quản lý Người dùng & Shipper</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/manager/reconciliation' as any)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="cash" size={20} color="#059669" />
                </View>
                <Text style={styles.menuItemText}>Đối soát tiền COD & Công nợ</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/manager/config' as any)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="settings-outline" size={20} color="#475569" />
                </View>
                <Text style={styles.menuItemText}>Cấu hình khu vực & Phí ship</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>
          </View>
        )}

        {/* PHẦN DÀNH CHO SHIPPER */}
        {isShipper && (
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>VẬN HÀNH SHIPPER</Text>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="time" size={20} color="#C2410C" />
                </View>
                <Text style={styles.menuItemText}>Lịch sử ca làm việc</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>
          </View>
        )}

        {/* PHẦN DÀNH CHO CUSTOMER (KHÔNG PHẢI SHIPPER/MANAGER) */}
        {!isShipper && !isManager && (
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>DỊCH VỤ KHÁCH HÀNG</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/address-manager' as any)}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="business" size={20} color="#1E40AF" />
                </View>
                <Text style={styles.menuItemText}>Quản lý Kho lấy hàng</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="card" size={20} color="#059669" />
                </View>
                <Text style={styles.menuItemText}>Ví & Ngân hàng</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuGroup}>
          <Text style={styles.menuGroupTitle}>HỆ THỐNG</Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Đăng xuất</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionLabel}>OMS Phiên bản 1.1.0 • Chế độ {isManager ? 'Quản trị' : 'Thành viên'}</Text>
      </ScrollView>

      {/* Modal chỉnh sửa thông tin */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật thông tin</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Ionicons name="close" size={28} color="#4B5563" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Họ và tên</Text>
            <TextInput 
              style={styles.input} 
              value={editName} 
              onChangeText={setEditName} 
              placeholder="Họ tên đầy đủ"
              placeholderTextColor="#94A3B8"
            />
            
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput 
              style={styles.input} 
              value={editPhone} 
              onChangeText={setEditPhone} 
              placeholder="Số điện thoại liên hệ" 
              keyboardType="phone-pad" 
              placeholderTextColor="#94A3B8"
            />
            
            <TouchableOpacity 
              style={[styles.saveButton, saving && { opacity: 0.6 }]} 
              onPress={handleUpdateProfile} 
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Lưu thay đổi</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    backgroundColor: '#fff', 
    paddingVertical: 15, 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F3F4F6', 
    paddingTop: Platform.OS === 'ios' ? 45 : 15 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  scrollContent: { padding: 20 },
  
  userCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 24, 
    alignItems: 'center', 
    marginBottom: 24, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 10 
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E40AF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  userEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  roleBadge: { backgroundColor: '#EFF6FF', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
  roleText: { fontSize: 9, fontWeight: '900', color: '#1E40AF' },
  editBtnCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  
  menuGroup: { marginBottom: 24 },
  menuGroupTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 12, marginLeft: 6, letterSpacing: 0.5 },
  menuItem: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#F3F4F6' 
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuItemText: { fontSize: 14, color: '#374151', marginLeft: 14, fontWeight: '600' },
  
  versionLabel: { textAlign: 'center', color: '#9CA3AF', fontSize: 11, marginTop: 10, marginBottom: 40 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 15, fontSize: 15, color: '#111827', marginBottom: 18 },
  saveButton: { backgroundColor: '#1E40AF', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});