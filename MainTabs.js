// MainTabs.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Platform, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import DashboardScreen from './DashboardScreen';
import SettingsScreen from './SettingsScreen';

Icon.loadFont();
const Tab = createBottomTabNavigator();

export default function MainTabs({ route }) {
  const initialParams = route?.params ?? {};
  const navigation = useNavigation();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const { height } = useWindowDimensions();

  const go = (routeName) => {
    setShowQuickActions(false);
    setTimeout(() => navigation.navigate(routeName), 10);
  };

  // Altura “grande pero no exagerada”
  const sheetMinHeight = Math.min(420, Math.round(height * 0.8));

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: '#000',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#000',
            borderTopWidth: 0,
            height: 80,
          },
          tabBarIcon: ({ color, focused }) => {
            const iconMap = {
              Home: focused ? 'home' : 'home-outline',
              Configuración: focused ? 'settings' : 'settings-outline',
            };
            const iconName = iconMap[route.name] || 'ellipse-outline';
            return <Icon name={iconName} size={24} color={color} />;
          },
        })}
      >
        {/* 🏠 Inicio */}
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          initialParams={initialParams}
          options={{ title: 'Inicio' }}
        />

        {/* ➕ Botón central -> abre modal de 2 opciones */}
        <Tab.Screen
          name="Agregar"
          component={() => null}
          options={{
            title: '',
            tabBarLabel: '',
            tabBarIcon: () => null,
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                activeOpacity={0.85}
                style={styles.plusButtonContainer}
                onPress={() => setShowQuickActions(true)}
              >
                <View style={styles.plusButton}>
                  <Icon name="add" size={28} color="#fff" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />

        {/* ⚙️ Configuración */}
        <Tab.Screen
          name="Configuración"
          component={SettingsScreen}
          options={{ title: 'Configuración' }}
        />
      </Tab.Navigator>

      {/* 🔽 Modal: elegir tipo de gasto */}
      <Modal
        visible={showQuickActions}
        animationType="fade"
        transparent
        onRequestClose={() => setShowQuickActions(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowQuickActions(false)} />
        <View style={[styles.sheet, { minHeight: sheetMinHeight }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Agregar</Text>
          <Text style={styles.sheetSubtitle}>Elige el tipo de gasto</Text>

          {/* Opción 1: Gasto normal */}
          <TouchableOpacity style={styles.actionRow} onPress={() => go('GastoEntry')}>
            <View style={styles.actionIcon}>
              <Icon name="cash-outline" size={26} />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Gasto normal</Text>
              <Text style={styles.actionSubtitle}>Registrar un gasto puntual</Text>
            </View>
            <Icon name="chevron-forward" size={22} />
          </TouchableOpacity>

          {/* Opción 2: Gasto recurrente */}
          <TouchableOpacity style={styles.actionRow} onPress={() => go('RecurringExpensesScreen')}>
            <View style={styles.actionIcon}>
              <Icon name="repeat-outline" size={26} />
            </View>
            <View style={styles.actionTextBox}>
              <Text style={styles.actionTitle}>Gasto recurrente</Text>
              <Text style={styles.actionSubtitle}>Arriendo, luz, internet… automáticos</Text>
            </View>
            <Icon name="chevron-forward" size={22} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowQuickActions(false)}>
            <Text style={styles.cancelTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Botón flotante central
  plusButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -10,
  },
  plusButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3.5,
    elevation: 6,
  },

  // Modal tipo bottom sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // antes: minHeight: 300 -> ahora se define dinámicamente desde el componente
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 6,
    backgroundColor: '#e6e6e6',
    borderRadius: 999,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { color: '#666', marginTop: 4, marginBottom: 14, fontSize: 13 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16, // más alto para tacto
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    gap: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextBox: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  actionSubtitle: { color: '#666', marginTop: 4, fontSize: 13 },

  cancelBtn: {
    marginTop: 12,
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelTxt: { fontWeight: '800', fontSize: 15 },
});
