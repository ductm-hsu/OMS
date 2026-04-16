import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trang Chủ</Text>
      <Text>Chào mừng bạn đến với OMS!</Text>

      {/* Nút nổi (FAB) hình tròn, màu đỏ */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/create-order' as never)}
        activeOpacity={0.8} 
      >
        <Ionicons name="add" size={32} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f8f9fa' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#0056b3', 
    marginBottom: 10 
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60, // Ép chiều rộng
    height: 60, // Ép chiều cao bằng nhau tạo hình vuông
    borderRadius: 30, // Bo góc bằng một nửa kích thước để thành hình tròn
    backgroundColor: '#ff6b6b', // Màu đỏ san hô thân thiện
    justifyContent: 'center', // Căn giữa dấu cộng
    alignItems: 'center',
    
    // Đổ bóng mượt mà
    elevation: 6,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
});