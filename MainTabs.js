import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import DashboardScreen from './DashboardScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs({ route }) {
  const initialParams = route?.params ?? {};

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#000',
          borderTopWidth: 0.2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          // Definir íconos para cada pestaña
          const iconMap = {
            Home: focused ? 'home' : 'home-outline',
            Configuración: focused ? 'settings' : 'settings-outline',
          };

          // Si no hay ícono definido, usar uno genérico
          const iconName = iconMap[route.name] || 'ellipse-outline';
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        initialParams={initialParams}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Configuración"
        component={SettingsScreen}
        options={{ title: 'Configuración' }}
      />
    </Tab.Navigator>
  );
}
