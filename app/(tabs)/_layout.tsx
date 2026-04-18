import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

/**
 * Layout chính của hệ thống Tab (app/(tabs)/_layout.tsx)
 * - Quản lý hiển thị các Tab dựa trên vai trò người dùng (Manager, Shipper, Customer).
 * - Đã cập nhật: Chỉ cho phép 'customer' xem tab Thông báo.
 * - Đã thêm trạng thái chờ (Loading) để tránh việc hiển thị sai tab trước khi lấy được Role.
 */
export default function App() {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('userRole');
        setRole(storedRole);
      } catch (e) {
        console.error('Lỗi lấy vai trò người dùng:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRole();
  }, []);

  // Xác định các điều kiện hiển thị dựa trên Role
  const isShipper = role === 'shipper';
  const isManager = role === 'manager';
  // Chỉ tính là Customer nếu role thực sự là 'customer' (để tránh hiển thị nhầm khi role chưa load xong)
  const isCustomer = role === 'customer';

  // Hiển thị màn hình chờ trong khi xác định quyền truy cập
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: '#1E40AF',
        tabBarInactiveTintColor: '#94A3B8',
        headerShown: false,
        tabBarStyle: { 
          paddingBottom: 5, 
          height: 65,
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          backgroundColor: '#FFFFFF'
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          textTransform: 'uppercase',
          marginBottom: 4
        }
      }}
    >
      {/* 1. TRANG CHỦ (Dashboard cho Customer và Manager) */}
      <Tabs.Screen
        name="home"
        options={{
          title: isManager ? 'Thống Kê' : 'Trang Chủ',
          // Ẩn tab này đối với Shipper
          href: isShipper ? null : '/home', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 2. TRANG CHỦ SHIPPER (Chỉ dành cho Shipper) */}
      <Tabs.Screen
        name="shipper-home"
        options={{
          title: 'Trang Chủ',
          href: isShipper ? '/shipper-home' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 3. VẬN HÀNH SHIPPER (Công việc của Shipper) */}
      <Tabs.Screen
        name="shipper-tasks"
        options={{
          title: 'Vận Hành',
          href: isShipper ? '/shipper-tasks' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bicycle' : 'bicycle-outline'} size={24} color={color} />
          ),
        }}
      />
      
      {/* 4. ĐƠN HÀNG (Quản lý đơn cho Customer/Manager) */}
      <Tabs.Screen
        name="orders"
        options={{
          title: isManager ? 'Hệ Thống' : 'Đơn Gửi',
          href: !isShipper ? '/orders' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 5. THÔNG BÁO (Logic: Chỉ dành cho Customer mới được thấy) */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông Báo',
          // Sử dụng href: null để ẩn tab hoàn toàn khỏi Tab Bar
          href: isCustomer ? '/notifications' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 6. TÀI KHOẢN (Hồ sơ, Đổi mật khẩu, Quản lý kho) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài Khoản',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* Ẩn các route bổ trợ hoặc route mặc định khỏi thanh Tab */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}