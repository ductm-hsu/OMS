import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; 
import { useEffect, useState } from 'react';
// Sửa lỗi import AsyncStorage và đảm bảo tương thích với môi trường mobile
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Layout chính của hệ thống Tab (app/(tabs)/_layout.tsx)
 * Quản lý phân quyền hiển thị Tab cho 3 vai trò: Customer, Shipper, Manager
 */
export default function TabLayout() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('userRole');
        setRole(storedRole);
      } catch (e) {
        console.error('Lỗi lấy role từ bộ nhớ:', e);
      }
    };
    fetchRole();
  }, []);

  const isShipper = role === 'shipper';
  const isManager = role === 'manager';

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
          borderTopColor: '#F1F5F9'
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          textTransform: 'uppercase',
          marginBottom: 4
        }
      }}
    >
      {/* 1. TRANG CHỦ (Dành cho Khách hàng & Manager) */}
      <Tabs.Screen
        name="home"
        options={{
          title: isManager ? 'Thống Kê' : 'Trang Chủ',
          href: isShipper ? null : '/home', 
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 2. TRANG CHỦ SHIPPER (Chỉ hiển thị cho Shipper) */}
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

      {/* 3. VẬN HÀNH (Chỉ hiển thị cho Shipper) */}
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
      
      {/* 4. ĐƠN HÀNG (Hiển thị cho Khách và Manager) */}
      {/* Đối với Manager, tab này sẽ đổi tên thành "Hệ Thống" để quản lý toàn bộ đơn */}
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

      {/* 5. TÀI KHOẢN (Hiển thị cho tất cả các vai trò) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài Khoản',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* Vô hiệu hóa route index mặc định để tránh nhầm lẫn */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}