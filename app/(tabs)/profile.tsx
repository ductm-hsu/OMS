import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/utils/supabase';

export default function ProfileScreen() {
  const router = useRouter();

  // Hàm xử lý Đăng xuất
  const handleLogout = async () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { 
        text: 'Đồng ý', 
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/' as never); // Đẩy về trang Login
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tài Khoản</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Khối thông tin User */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>Chủ Shop</Text>
            <Text style={styles.userPhone}>Đang hoạt động</Text>
          </View>
        </View>

        {/* Khối Menu Quản lý */}
        <View style={styles.menuGroup}>
          <Text style={styles.menuGroupTitle}>QUẢN LÝ</Text>
          
          {/* Nút bấm sang trang Quản lý Kho */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => router.push('/address-manager' as never)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="location" size={24} color="#0056b3" />
              <Text style={styles.menuItemText}>Quản lý Kho lấy hàng</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="card" size={24} color="#28a745" />
              <Text style={styles.menuItemText}>Tài khoản Ngân hàng (Ví)</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Khối Menu Cài đặt */}
        <View style={styles.menuGroup}>
          <Text style={styles.menuGroupTitle}>HỆ THỐNG</Text>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings" size={24} color="#6c757d" />
              <Text style={styles.menuItemText}>Cài đặt ứng dụng</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out" size={24} color="#d9534f" />
              <Text style={[styles.menuItemText, { color: '#d9534f' }]}>Đăng xuất</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { backgroundColor: '#fff', paddingTop: 50, paddingBottom: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  scrollContent: { padding: 16 },
  
  userCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0056b3', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  userInfo: { flex: 1 },
  userName: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  userPhone: { fontSize: 14, color: '#28a745' },

  menuGroup: { marginBottom: 24 },
  menuGroupTitle: { fontSize: 13, fontWeight: 'bold', color: '#8e8e93', marginBottom: 8, marginLeft: 8 },
  menuItem: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemText: { fontSize: 16, color: '#333', marginLeft: 12, fontWeight: '500' },
});