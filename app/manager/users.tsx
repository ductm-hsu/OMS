import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl, 
  Alert, 
  SafeAreaView, 
  TextInput,
  Modal,
  Platform,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
// Sử dụng các icon từ expo/vector-icons
import { 
  Ionicons, 
  MaterialIcons,
  FontAwesome5 
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Đảm bảo đường dẫn import chính xác với cấu trúc thực tế của bạn
import { supabase } from '../../src/utils/supabase';

/**
 * MÀN HÌNH QUẢN LÝ NGƯỜI DÙNG (Quản trị viên)
 * - Hiển thị danh sách người dùng, phân loại theo Role.
 * - Cho phép chỉnh sửa thông tin thành viên hiện có.
 * - Cho phép tạo mới tài khoản cho Shipper và Customer.
 */
export default function App() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State tìm kiếm và lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'customer' | 'shipper' | 'manager'>('all');

  // State chỉnh sửa
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // State thêm mới
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    phone_number: '',
    role: 'customer' as 'customer' | 'shipper' | 'manager'
  });

  const [processing, setProcessing] = useState(false);

  // 1. Tải danh sách người dùng
  const fetchUsers = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const { data, error } = await supabase
        .from('tb_users')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Lỗi tải dữ liệu người dùng:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  // 2. Logic lọc danh sách người dùng dựa trên tìm kiếm và vai trò
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.phone_number?.includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower);
      
      return matchesRole && matchesSearch;
    });
  }, [users, searchQuery, filterRole]);

  // 3. Xử lý Cập nhật thông tin thành viên
  const handleUpdateUser = async () => {
    if (!selectedUser?.full_name?.trim()) {
      Alert.alert('Thông báo', 'Họ tên không được để trống.');
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('tb_users')
        .update({
          full_name: selectedUser.full_name,
          phone_number: selectedUser.phone_number,
          role: selectedUser.role
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      Alert.alert('Thành công', 'Thông tin thành viên đã được cập nhật.');
      setEditModalVisible(false);
      fetchUsers();
    } catch (e: any) {
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin.');
    } finally {
      setProcessing(false);
    }
  };

  // 4. Xử lý Tạo tài khoản mới (Auth + Table tb_users)
  const handleCreateUser = async () => {
    const { email, password, full_name, phone_number, role } = newUser;

    if (!email || !password || !full_name || !phone_number) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setProcessing(true);
    try {
      // BƯỚC A: Tạo tài khoản Auth trong Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (authError) throw authError;

      // BƯỚC B: Chèn thông tin chi tiết vào bảng tb_users
      if (authData?.user) {
        const { error: dbError } = await supabase
          .from('tb_users')
          .insert([{
            id: authData.user.id,
            email: email.trim().toLowerCase(),
            full_name: full_name.trim(),
            phone_number: phone_number.trim(),
            role: role
          }]);

        if (dbError) throw dbError;
      }

      Alert.alert('Thành công', `Đã tạo tài khoản ${role.toUpperCase()} mới.`);
      setAddModalVisible(false);
      // Reset form
      setNewUser({ email: '', password: '', full_name: '', phone_number: '', role: 'customer' });
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Lỗi tạo tài khoản', error.message);
    } finally {
      setProcessing(false);
    }
  };

  // Helper: Trả về style theo vai trò
  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'manager': return { bg: '#FEE2E2', color: '#B91C1C', label: 'Quản lý' };
      case 'shipper': return { bg: '#E0F2FE', color: '#0369A1', label: 'Bưu tá' };
      default: return { bg: '#F3F4F6', color: '#374151', label: 'Khách' };
    }
  };

  const renderUserItem = ({ item }: { item: any }) => {
    const roleStyle = getRoleStyle(item.role);
    // Lấy chữ cái đầu của tên để làm avatar mặc định
    const initials = item.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

    return (
      <TouchableOpacity 
        style={styles.userCard}
        onPress={() => {
          setSelectedUser({ ...item });
          setEditModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: roleStyle.color + '15' }]}>
          <Text style={[styles.avatarText, { color: roleStyle.color }]}>{initials}</Text>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userNameText}>{item.full_name || 'Thành viên'}</Text>
          <Text style={styles.userSubText}>{item.phone_number || 'Chưa cập nhật SĐT'}</Text>
          <Text style={styles.userEmailText}>{item.email}</Text>
        </View>

        <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
          <Text style={[styles.roleBadgeText, { color: roleStyle.color }]}>{roleStyle.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header điều hướng và tìm kiếm */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Quản Lý Thành Viên</Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Tìm theo tên, SĐT hoặc Email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Bộ lọc vai trò */}
        <View style={{ marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'customer', label: 'Khách hàng' },
              { id: 'shipper', label: 'Bưu tá' },
              { id: 'manager', label: 'Quản lý' }
            ].map(role => (
              <TouchableOpacity 
                key={role.id}
                style={[styles.filterChip, filterRole === role.id && styles.filterChipActive]}
                onPress={() => setFilterRole(role.id as any)}
              >
                <Text style={[styles.filterText, filterRole === role.id && styles.filterTextActive]}>{role.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Danh sách người dùng */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#BE185D']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={64} color="#E5E7EB" />
            <Text style={styles.emptyText}>Không tìm thấy thành viên nào.</Text>
          </View>
        ) : <ActivityIndicator size="large" color="#BE185D" style={{ marginTop: 50 }} />}
      />

      {/* FAB - Nút thêm mới tài khoản */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setAddModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* MODAL THÊM MỚI TÀI KHOẢN */}
      <Modal visible={addModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tạo tài khoản mới</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <Text style={styles.inputLabel}>Họ và tên *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Ví dụ: Nguyễn Văn A"
                value={newUser.full_name}
                onChangeText={(text) => setNewUser({ ...newUser, full_name: text })}
              />

              <Text style={styles.inputLabel}>Số điện thoại *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Số điện thoại liên hệ"
                value={newUser.phone_number}
                onChangeText={(text) => setNewUser({ ...newUser, phone_number: text })}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Email đăng nhập *</Text>
              <TextInput 
                style={styles.input}
                placeholder="email@vidu.com"
                value={newUser.email}
                onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Mật khẩu khởi tạo *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Tối thiểu 6 ký tự"
                value={newUser.password}
                onChangeText={(text) => setNewUser({ ...newUser, password: text })}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Vai trò trong hệ thống</Text>
              <View style={styles.rolePickerRow}>
                {['customer', 'shipper'].map((r) => (
                  <TouchableOpacity 
                    key={r}
                    style={[styles.roleOption, newUser.role === r && styles.roleOptionActive]}
                    onPress={() => setNewUser({ ...newUser, role: r as any })}
                  >
                    <Text style={[styles.roleOptionText, newUser.role === r && styles.roleOptionTextActive]}>
                      {r === 'customer' ? 'Khách hàng' : 'Bưu tá'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={[styles.saveBtn, processing && { opacity: 0.6 }]}
              onPress={handleCreateUser}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>XÁC NHẬN TẠO TÀI KHOẢN</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL CHỈNH SỬA THÀNH VIÊN */}
      <Modal visible={editModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cập nhật Thành viên</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Họ và tên</Text>
              <TextInput 
                style={styles.input}
                value={selectedUser?.full_name}
                onChangeText={(text) => setSelectedUser({ ...selectedUser, full_name: text })}
              />

              <Text style={styles.inputLabel}>Số điện thoại</Text>
              <TextInput 
                style={styles.input}
                value={selectedUser?.phone_number}
                onChangeText={(text) => setSelectedUser({ ...selectedUser, phone_number: text })}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Vai trò</Text>
              <View style={styles.rolePickerRow}>
                {['customer', 'shipper', 'manager'].map((r) => (
                  <TouchableOpacity 
                    key={r}
                    style={[styles.roleOption, selectedUser?.role === r && styles.roleOptionActive]}
                    onPress={() => setSelectedUser({ ...selectedUser, role: r })}
                  >
                    <Text style={[styles.roleOptionText, selectedUser?.role === r && styles.roleOptionTextActive]}>
                      {r === 'customer' ? 'Khách' : (r === 'shipper' ? 'Bưu tá' : 'Quản lý')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.saveBtn, (processing || !selectedUser?.full_name) && { opacity: 0.6 }]}
                  onPress={handleUpdateUser}
                  disabled={processing || !selectedUser?.full_name}
                >
                  {processing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>LƯU THAY ĐỔI</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9', 
    paddingTop: Platform.OS === 'ios' ? 10 : 25 
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 15 },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#111827' },
  
  searchBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F3F4F6', 
    marginHorizontal: 16, 
    borderRadius: 14, 
    paddingHorizontal: 12, 
    height: 48,
    marginBottom: 16
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#1F2937', fontWeight: '500' },
  
  filterContainer: { paddingHorizontal: 16 },
  filterChip: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 25, 
    backgroundColor: '#F3F4F6', 
    marginRight: 10, 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  filterChipActive: { backgroundColor: '#BE185D', borderColor: '#BE185D' },
  filterText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  filterTextActive: { color: '#fff' },

  listPadding: { padding: 16, paddingBottom: 100 },
  userCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 22, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#F1F5F9',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  avatar: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
  userInfo: { flex: 1, marginLeft: 16 },
  userNameText: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  userSubText: { fontSize: 13, color: '#64748B', marginTop: 3, fontWeight: '600' },
  userEmailText: { fontSize: 11, color: '#94A3B8', marginTop: 3, fontWeight: '500' },
  
  roleBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  roleBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  fab: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#BE185D',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#BE185D',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },

  emptyBox: { alignItems: 'center', marginTop: 120, paddingHorizontal: 50 },
  emptyText: { textAlign: 'center', marginTop: 24, color: '#94A3B8', fontSize: 15, fontWeight: '600', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%', elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  closeBtn: { padding: 5 },
  
  inputLabel: { fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, marginTop: 15 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, fontSize: 15, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0' },
  
  rolePickerRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  roleOption: { flex: 1, paddingVertical: 14, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  roleOptionActive: { backgroundColor: '#FDF2F8', borderColor: '#BE185D' },
  roleOptionText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
  roleOptionTextActive: { color: '#BE185D' },

  modalFooter: { marginTop: 35 },
  saveBtn: { 
    backgroundColor: '#BE185D', 
    borderRadius: 18, 
    paddingVertical: 18, 
    alignItems: 'center', 
    elevation: 6, 
    shadowColor: '#BE185D', 
    shadowOpacity: 0.3, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 6 } 
  },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 }
});