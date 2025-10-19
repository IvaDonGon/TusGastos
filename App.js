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

import WelcomeScreen from './WelcomeScreen';   // ⬅️ NUEVO (inicio)
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import Onboarding from './Onboarding';
import MainTabs from './MainTabs';
import EditProfileScreen from './EditProfileScreen';

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
          <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
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
