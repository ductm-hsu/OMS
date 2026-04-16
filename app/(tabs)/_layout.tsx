import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabLayout() {
  const [role, setRole] = useState<string | null>(null);

  // Lấy role từ bộ nhớ điện thoại khi màn hình Tab vừa mở lên
  useEffect(() => {
    const fetchRole = async () => {
      const storedRole = await AsyncStorage.getItem('userRole');
      setRole(storedRole);
    };
    fetchRole();
  }, []);

  return (
    <Tabs 
      screenOptions={{
        tabBarActiveTintColor: '#0056b3',
        tabBarInactiveTintColor: '#8e8e93',
        headerShown: false,
        tabBarStyle: { paddingBottom: 5, height: 60 }
      }}
    >
      {/* 1. Trang Chủ: AI CŨNG THẤY */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang Chủ',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      
      {/* 2. Đơn Hàng: CHỈ KHÁCH HÀNG MỚI THẤY */}
      {/* Nếu role không phải customer, href = null sẽ làm nút này biến mất */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Đơn Hàng',
          href: (role === 'customer' ? '/orders' : null) as any,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 3. Cá Nhân: AI CŨNG THẤY */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá Nhân',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}