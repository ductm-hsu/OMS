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
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Đảm bảo đường dẫn import supabase chính xác với cấu trúc thư mục của bạn
import { supabase } from '../../src/utils/supabase';

// Định nghĩa Interface User tương ứng với bảng tb_users
interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  
  // States quản lý dữ liệu
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States cho Modal chỉnh sửa
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // 1. Lấy thông tin người dùng từ database (tb_users)
  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      
      if (authData?.user) {
        const { data, error } = await supabase
          .from('tb_users')
          .select('id, full_name, phone_number, email')
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

  // 2. Cập nhật thông tin cá nhân (vào bảng tb_users)
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
          .update({
            full_name: editName,
            phone_number: editPhone,
          })
          .eq('id', authData.user.id);

        if (error) throw error;

        // Cập nhật UI cục bộ
        setProfile(prev => prev ? { ...prev, full_name: editName, phone_number: editPhone } : null);
        setIsEditModalVisible(false);
        Alert.alert('Thành công', 'Thông tin cá nhân đã được cập nhật.');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', 'Cập nhật thất bại: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 3. Xử lý Đăng xuất triệt để
  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn thoát khỏi hệ thống?', [
      { text: 'Hủy', style: 'cancel' },
      { 
        text: 'Đăng xuất', 
        style: 'destructive',
        onPress: async () => {
          try {
            // Bước 1: Đăng xuất khỏi Supabase
            await supabase.auth.signOut();
            
            // Bước 2: Xóa sạch Role và dữ liệu trong AsyncStorage
            // Điều này cực kỳ quan trọng để TabLayout nhận diện trạng thái "null"
            await AsyncStorage.multiRemove(['userRole', 'supabase.auth.token']);
            
            // Bước 3: Điều hướng về màn hình Login gốc (app/index.tsx)
            // Sử dụng replace('/') để thoát hẳn khỏi cây thư mục (tabs)
            router.replace('/' as any); 
          } catch (error: any) {
            Alert.alert('Lỗi', 'Đăng xuất thất bại: ' + error.message);
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0056b3" />
        <Text style={{ marginTop: 12, color: '#666' }}>Đang tải thông tin...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tài Khoản</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Khối thông tin User chính */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile?.full_name || 'Người dùng OMS'}</Text>
            <Text style={styles.userEmail}>{profile?.email}</Text>
            <Text style={styles.userPhoneStatus}>
              {profile?.phone_number ? `SĐT: ${profile.phone_number}` : 'Chưa cập nhật SĐT'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.editBtnCircle} 
            onPress={() => setIsEditModalVisible(true)}
          >
            <Ionicons name="pencil" size={20} color="#0056b3" />
          </TouchableOpacity>
        </View>

        {/* Khối Menu Quản lý */}
        <View style={styles.menuGroup}>
          <Text style={styles.menuGroupTitle}>QUẢN LÝ</Text>
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/address-manager' as any)}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="business" size={20} color="#0056b3" />
              </View>
              <Text style={styles.menuItemText}>Quản lý Kho lấy hàng</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="card" size={20} color="#2E7D32" />
              </View>
              <Text style={styles.menuItemText}>Ví & Ngân hàng</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E0" />
          </TouchableOpacity>
        </View>

        {/* Khối Menu Hệ thống */}
        <View style={styles.menuGroup}>
          <Text style={styles.menuGroupTitle}>HỆ THỐNG</Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF5F5' }]}>
                <Ionicons name="log-out-outline" size={20} color="#C53030" />
              </View>
              <Text style={[styles.menuItemText, { color: '#C53030' }]}>Đăng xuất tài khoản</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionLabel}>OMS v1.1.0 • 2024</Text>
      </ScrollView>

      {/* Modal Chỉnh sửa hồ sơ */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật thông tin</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Ionicons name="close" size={28} color="#4A5568" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Họ và tên *</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nhập họ tên đầy đủ"
                placeholderTextColor="#A0AEC0"
              />

              <Text style={styles.inputLabel}>Số điện thoại</Text>
              <TextInput
                style={styles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Số điện thoại liên hệ"
                keyboardType="phone-pad"
                placeholderTextColor="#A0AEC0"
              />

              <TouchableOpacity 
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleUpdateProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: { 
    backgroundColor: '#fff', 
    paddingTop: 15, 
    paddingBottom: 15, 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#EDF2F7' 
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D3748' },
  scrollContent: { padding: 20 },
  
  userCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 22, 
    alignItems: 'center', 
    marginBottom: 24, 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, 
    shadowRadius: 12 
  },
  avatar: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: '#0056b3', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16 
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 19, fontWeight: 'bold', color: '#1A202C', marginBottom: 2 },
  userEmail: { fontSize: 13, color: '#718096', marginBottom: 3 },
  userPhoneStatus: { fontSize: 13, color: '#38A169', fontWeight: '600' },
  editBtnCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EBF8FF', justifyContent: 'center', alignItems: 'center' },

  menuGroup: { marginBottom: 24 },
  menuGroupTitle: { fontSize: 12, fontWeight: '800', color: '#A0AEC0', marginBottom: 12, marginLeft: 6, letterSpacing: 1 },
  menuItem: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 16, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EDF2F7'
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuItemText: { fontSize: 15, color: '#2D3748', marginLeft: 14, fontWeight: '600' },
  
  versionLabel: { textAlign: 'center', color: '#CBD5E0', fontSize: 11, marginTop: 10, marginBottom: 40 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30, 
    padding: 24, 
    paddingBottom: 40,
    minHeight: 450 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 30 
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A202C' },
  modalBody: {},
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#4A5568', marginBottom: 10 },
  input: { 
    backgroundColor: '#F7FAFC', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    borderRadius: 14, 
    padding: 16, 
    fontSize: 16, 
    color: '#2D3748', 
    marginBottom: 24 
  },
  saveButton: { 
    backgroundColor: '#0056b3', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center', 
    marginTop: 10,
    elevation: 4,
    shadowColor: '#0056b3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});