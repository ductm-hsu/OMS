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
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Đảm bảo tệp supabase.js tồn tại trong thư mục src/utils/ của dự án bạn
import { supabase } from '../../src/utils/supabase';

interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  role: string | null;
}

/**
 * MÀN HÌNH TÀI KHOẢN (app/(tabs)/profile.tsx)
 * Đã cập nhật phân quyền hiển thị menu:
 * - Manager: Quản lý User, Đối soát, Cấu hình. (Ẩn Kho hàng & Ví)
 * - Customer: Kho lấy hàng, Ví. (Ẩn menu Quản trị)
 * - Tất cả: Đổi mật khẩu, Đăng xuất.
 */
export default function App() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States cho chỉnh sửa Profile
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // States cho đổi mật khẩu
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
          // Đồng bộ role vào bộ nhớ tạm
          await AsyncStorage.setItem('userRole', data.role || 'customer');
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

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      Alert.alert('Thành công', 'Mật khẩu đã được thay đổi.');
      setIsPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
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
  const isManager = role === 'manager';
  const isCustomer = role === 'customer';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Hồ sơ cá nhân</Text></View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Card thông tin người dùng */}
        <View style={styles.userCard}>
          <View style={[styles.avatar, isManager && { backgroundColor: '#1E40AF' }]}>
            <Ionicons name={isManager ? "shield-checkmark" : "person"} size={32} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile?.full_name || 'Thành viên OMS'}</Text>
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

        {/* DỊCH VỤ KHÁCH HÀNG (Chỉ dành cho Customer) */}
        {isCustomer && (
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>DỊCH VỤ KHÁCH HÀNG</Text>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/addresses/manager' as any)}
            >
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

        {/* QUẢN TRỊ HỆ THỐNG (Dành riêng cho Manager) */}
        {isManager && (
          <View style={styles.menuGroup}>
            <Text style={styles.menuGroupTitle}>QUẢN TRỊ HỆ THỐNG</Text>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/manager/users' as any)}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FDF2F8' }]}>
                  <Ionicons name="people" size={20} color="#BE185D" />
                </View>
                <Text style={styles.menuItemText}>Quản lý Thành viên</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/manager/reconciliation' as any)}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                  <MaterialCommunityIcons name="cash-register" size={20} color="#C2410C" />
                </View>
                <Text style={styles.menuItemText}>Đối soát tài chính</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/manager/config' as any)}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="settings" size={20} color="#475569" />
                </View>
                <Text style={styles.menuItemText}>Cấu hình biểu phí</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
            </TouchableOpacity>
          </View>
        )}

        {/* HỆ THỐNG & BẢO MẬT (Dành cho tất cả) */}
        <View style={styles.menuGroup}>
          <Text style={styles.menuGroupTitle}>HỆ THỐNG & BẢO MẬT</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => setIsPasswordModalVisible(true)}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF9C3' }]}>
                <Ionicons name="lock-closed-outline" size={20} color="#A16207" />
              </View>
              <Text style={styles.menuItemText}>Đổi mật khẩu</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Đăng xuất</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionLabel}>OMS Phiên bản 1.2.0 • {isManager ? 'Admin Mode' : 'User Mode'}</Text>
      </ScrollView>

      {/* Modal chỉnh sửa thông tin Profile */}
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
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Họ tên đầy đủ" placeholderTextColor="#94A3B8" />
            
            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholder="Số điện thoại liên hệ" placeholderTextColor="#94A3B8" />
            
            <TouchableOpacity style={styles.saveButton} onPress={handleUpdateProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Lưu thay đổi</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal đổi mật khẩu */}
      <Modal visible={isPasswordModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đổi mật khẩu mới</Text>
              <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)}>
                <Ionicons name="close" size={28} color="#4B5563" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Mật khẩu mới</Text>
            <TextInput 
              style={styles.input} 
              value={newPassword} 
              onChangeText={setNewPassword} 
              secureTextEntry 
              placeholder="Tối thiểu 6 ký tự" 
              placeholderTextColor="#94A3B8"
            />
            
            <Text style={styles.inputLabel}>Xác nhận mật khẩu</Text>
            <TextInput 
              style={styles.input} 
              value={confirmPassword} 
              onChangeText={setConfirmPassword} 
              secureTextEntry 
              placeholder="Nhập lại mật khẩu" 
              placeholderTextColor="#94A3B8"
            />
            
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: '#059669' }]} 
              onPress={handleChangePassword} 
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Cập nhật mật khẩu</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  userCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 24, alignItems: 'center', marginBottom: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  userEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  roleBadge: { backgroundColor: '#EFF6FF', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 6 },
  roleText: { fontSize: 9, fontWeight: '900', color: '#1E40AF' },
  editBtnCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  menuGroup: { marginBottom: 24 },
  menuGroupTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 12, marginLeft: 6, letterSpacing: 0.5 },
  menuItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
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