import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../src/utils/supabase';

export default function AddressManagerScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Hàm lấy danh sách địa chỉ từ bảng tb_addresses
  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tb_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false }); // Mặc định hiện lên đầu

      if (error) throw error;
      setAddresses(data || []);
    } catch (error: any) {
      Alert.alert('Lỗi', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý Kho hàng</Text>
        <TouchableOpacity onPress={fetchAddresses}>
          <Ionicons name="refresh" size={24} color="#0056b3" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0056b3" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Bạn chưa có kho lấy hàng nào.</Text>
          }
        renderItem={({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
            {/* Bọc text vào 1 View có flex: 1 để chiếm không gian bên trái */}
            <View style={styles.headerLeft}>
                <Text style={styles.storeName} numberOfLines={1}>{item.contact_name}</Text>
                {item.is_default ? (
                <View style={styles.tagWrapper}>
                    <Text style={styles.defaultTag}>Mặc định</Text>
                </View>
                ) : null}
            </View>
            </View>
            
            <Text style={styles.phoneText}>{item.contact_phone}</Text>
            <Text style={styles.addressText} numberOfLines={2}>{item.address_detail}</Text>
            
            <View style={styles.actionRow}>
            {/* Nút Sửa */}
            <TouchableOpacity style={styles.iconBtn} onPress={() => {/* Logic sửa */}}>
                <Ionicons name="create-outline" size={22} color="#0056b3" />
            </TouchableOpacity>

            {/* Nút Xóa */}
            <TouchableOpacity style={[styles.iconBtn, { marginLeft: 15 }]} onPress={() => {/* Logic xóa */}}>
                <Ionicons name="trash-outline" size={22} color="#d9534f" />
            </TouchableOpacity>
            </View>
        </View>
        )}
        />
      )}

      {/* Nút thêm mới - Sẽ dẫn sang form thêm địa chỉ */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => router.push('/add-address' as never)}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.fabText}>Thêm Kho Mới</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { flexDirection: 'row', backgroundColor: '#fff', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#8e8e93' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  headerLeft: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  storeName: { 
    fontSize: 17, 
    fontWeight: 'bold', 
    color: '#0056b3', 
    marginRight: 10,
    maxWidth: '70%' // Chặn không cho tên quá dài đè lên tag
  },
  tagWrapper: {
    backgroundColor: '#eef6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultTag: { 
    color: '#0056b3', 
    fontSize: 11, 
    fontWeight: 'bold' 
  },
actionRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    alignItems: 'center',
    marginTop: 15, 
    paddingTop: 10, 
    borderTopWidth: 1, 
    borderTopColor: '#f1f3f5' 
  },
  iconBtn: {
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    marginLeft: 20,
    paddingVertical: 4
  },
  phoneText: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4 },
  addressText: { fontSize: 14, color: '#666', marginBottom: 16 },
  editBtn: { marginRight: 20 },
  editBtnText: { color: '#0056b3', fontWeight: 'bold' },
  deleteBtnText: { color: '#d9534f', fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 30, right: 20, flexDirection: 'row', backgroundColor: '#0056b3', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, alignItems: 'center', elevation: 6 },
  fabText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
});