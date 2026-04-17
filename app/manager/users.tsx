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
  ScrollView
} from 'react-native';
// Sử dụng các icon phổ biến từ expo/vector-icons
import { 
  Ionicons, 
  MaterialIcons,
  FontAwesome5 
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Import cấu hình supabase từ thư mục utils của dự án
import { supabase } from '../../src/utils/supabase';

/**
 * Màn hình Quản lý Người dùng (Manager)
 * Cho phép xem danh sách, tìm kiếm, lọc theo vai trò và cập nhật quyền hạn.
 */
export default function App() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Các state phục vụ tìm kiếm và lọc
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'customer' | 'shipper' | 'manager'>('all');

  // Các state phục vụ việc chỉnh sửa thông tin
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // 1. Hàm tải danh sách người dùng từ Database
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
      Alert.alert('Lỗi', 'Không thể kết nối với máy chủ để tải danh sách thành viên.');
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

  // 2. Logic lọc người dùng dựa trên tìm kiếm và vai trò
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.phone_number?.includes(searchQuery) ||
        user.email?.toLowerCase().includes(searchLower);
      
      return matchesRole && matchesSearch;
    });
  }, [users, searchQuery, filterRole]);

  // 3. Hàm cập nhật thông tin và vai trò người dùng
  const handleUpdateUser = async () => {
    if (!selectedUser?.full_name?.trim()) {
      Alert.alert('Thông báo', 'Họ tên không được để trống.');
      return;
    }

    setSaving(true);
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
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin. Vui lòng thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  // Hàm định dạng màu sắc theo vai trò
  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'manager': return { bg: '#FEE2E2', color: '#B91C1C', label: 'Quản lý' };
      case 'shipper': return { bg: '#E0F2FE', color: '#0369A1', label: 'Bưu tá' };
      default: return { bg: '#F3F4F6', color: '#374151', label: 'Khách' };
    }
  };

  const renderUserItem = ({ item }: { item: any }) => {
    const roleStyle = getRoleStyle(item.role);
    // Lấy chữ cái đầu của tên để làm avatar giả
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
          <Text style={styles.userNameText}>{item.full_name || 'Người dùng mới'}</Text>
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
      {/* Header chứa ô tìm kiếm và lọc */}
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
            placeholder="Tìm theo tên, SĐT, Email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#CBD5E0" />
            </TouchableOpacity>
          )}
        </View>

        {/* Thanh lọc theo Role */}
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

      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#BE185D']} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={64} color="#E5E7EB" />
            <Text style={styles.emptyText}>Không tìm thấy thành viên nào phù hợp yêu cầu lọc.</Text>
          </View>
        ) : <ActivityIndicator size="large" color="#BE185D" style={{ marginTop: 50 }} />}
      />

      {/* Modal Chỉnh sửa thông tin thành viên */}
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

              <Text style={styles.inputLabel}>Vai trò hệ thống</Text>
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
                  style={[styles.saveBtn, (saving || !selectedUser?.full_name) && { opacity: 0.6 }]}
                  onPress={handleUpdateUser}
                  disabled={saving || !selectedUser?.full_name}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>LƯU THAY ĐỔI</Text>
                  )}
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
    borderColor: '#E5E7EB' 
  },
  filterChipActive: { backgroundColor: '#BE185D', borderColor: '#BE185D' },
  filterText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  filterTextActive: { color: '#fff' },

  listPadding: { padding: 16, paddingBottom: 40 },
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

  emptyBox: { alignItems: 'center', marginTop: 120, paddingHorizontal: 50 },
  emptyText: { textAlign: 'center', marginTop: 24, color: '#94A3B8', fontSize: 15, fontWeight: '600', lineHeight: 22 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 32, padding: 24, maxHeight: '90%', elevation: 20 },
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