import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Màn hình Trang Chủ - Đã loại bỏ nút FAB để chuyển sang màn hình Danh sách đơn hàng
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trang Chủ</Text>
      <Text style={styles.subtitle}>Chào mừng bạn đến với hệ thống OMS!</Text>
      
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Tất cả các tính năng quản lý và tạo đơn hàng hiện đã được tập trung tại tab "Đơn Hàng".
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f8f9fa',
    padding: 20
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#0056b3', 
    marginBottom: 8 
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 30
  },
  infoCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  infoText: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 20
  }
});