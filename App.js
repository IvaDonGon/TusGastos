/**
 * App.js
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './ThemeContext';

import Ionicons from 'react-native-vector-icons/Ionicons';
Ionicons.loadFont();

// 🧩 Importaciones de pantallas
import WelcomeScreen from './WelcomeScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import Onboarding from './Onboarding';
import MainTabs from './MainTabs';
import EditProfileScreen from './EditProfileScreen';
import GastoEntryScreen from './GastoEntryScreen';
import TipoGastoScreen from './TipoGastoScreen';   // 👈 FALTABA ESTA LÍNEA
import RecurringExpensesScreen from './RecurringExpensesScreen'; 
import RecurringListScreen from './RecurringListScreen';
import ExpensesListScreen from './ExpensesListScreen';
import RecurringConfirmScreen from './RecurringConfirmScreen';


const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { theme } = useTheme();

  // Mapear ThemeContext a React Navigation
  const navTheme = theme.isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.colors.background,
          text: theme.colors.text,
          card: theme.colors.card,
          border: 'transparent',
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.colors.background,
          text: theme.colors.text,
          card: theme.colors.card,
          border: 'transparent',
        },
      };

  return (
    <>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen
            name="LoginScreen"
            component={LoginScreen}
            options={{ headerShown: false, title: 'Iniciar sesión'}}
          />
          <Stack.Screen
            name="RegisterScreen"
            component={RegisterScreen}
            options={{ headerShown: false, title: 'Registro de usuario' }}
          />
          <Stack.Screen
            name="Onboarding"
            component={Onboarding}
            options={{ headerShown: false, title: 'Completar perfil' }}
          />
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
<Stack.Screen
  name="ExpensesList"
  component={ExpensesListScreen}
  options={{ title: 'Todos los gastos', headerShown: false }}
/>
          {/* 💰 Pantalla para crear un gasto */}
          <Stack.Screen
            name="GastoEntry"
            component={GastoEntryScreen}
            options={{ title: 'Nuevo Gasto' }}
          />

          {/* 💡 Nueva pantalla de tipos de gasto */}
          <Stack.Screen
            name="TipoGasto"
            component={TipoGastoScreen}
            options={{ title: 'Tipos de Gasto' }}
          />

          {/* 🧍 Edición de perfil */}
          <Stack.Screen
            name="EditProfileScreen"
            component={EditProfileScreen}
            options={{ title: 'Editar perfil' }}
          />
          <Stack.Screen
  name="RecurringConfirm"
  component={RecurringConfirmScreen}
  options={{ headerShown: false, title: 'Por confirmar' }}
/>
<Stack.Screen
  name="RecurringList"
  component={RecurringListScreen}
  options={{ title: 'Recurrentes activos' }}
/>
          <Stack.Screen
  name="RecurringExpensesScreen"
  component={RecurringExpensesScreen}
  options={{ title: 'Gastos recurrentes' }}
/>
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
