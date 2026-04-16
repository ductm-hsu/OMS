import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * TabLayout: Cấu trúc các Tab phía dưới màn hình.
 * Sau khi bạn đổi tên file app/(tabs)/index.tsx thành home.tsx,
 * tên màn hình (name) ở đây phải chuyển thành "home" để khớp với router.
 */
export default function TabLayout() {
  const [role, setRole] = useState<string | null>(null);

  // Lấy role từ bộ nhớ để kiểm tra quyền hiển thị Tab Đơn Hàng
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('userRole');
        setRole(storedRole);
      } catch (e) {
        console.error('Lỗi khi lấy role:', e);
      }
    };
    fetchRole();
  }, []);

  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: '#0056b3',
        tabBarInactiveTintColor: '#8e8e93',
        headerShown: false,
        tabBarStyle: { 
          paddingBottom: 5, 
          height: 60,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f3f5'
        }
      }}
    >
      {/* 1. Trang Chủ: Đã đổi tên name từ "index" thành "home" */}
      {/* Route này sẽ ánh xạ tới file app/(tabs)/home.tsx */}
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang Chủ',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      
      {/* 2. Đơn Hàng: Chỉ hiển thị cho khách hàng */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Đơn Hàng',
          // href: null giúp ẩn nút này khỏi thanh menu nếu không có quyền truy cập
          href: (role === 'customer' ? '/orders' : null) as any,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 3. Cá Nhân */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá Nhân',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Vô hiệu hóa route index trong nhóm tabs để tránh lỗi Unmatched Route */}
      {/* Vì trang chủ thực sự hiện tại nằm ở file gốc app/index.tsx (Trang Login) */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}