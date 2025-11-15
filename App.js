/**
 * App.js
 * – FCM básico con setupPushBasic() desde ./push
 * – Guarda token en Supabase (tabla user_devices)
 * – Navega cuando el usuario toca una notificación
 */

import React, { useEffect, useRef } from 'react';
import { StatusBar, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider, useTheme } from './ThemeContext';

import Ionicons from 'react-native-vector-icons/Ionicons';
Ionicons.loadFont();

// 🧩 Pantallas
import WelcomeScreen from './WelcomeScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import Onboarding from './Onboarding';
import MainTabs from './MainTabs';
import EditProfileScreen from './EditProfileScreen';
import GastoEntryScreen from './GastoEntryScreen';
import TipoGastoScreen from './TipoGastoScreen';
import RecurringExpensesScreen from './RecurringExpensesScreen';
import RecurringListScreen from './RecurringListScreen';
import ExpensesListScreen from './ExpensesListScreen';
import RecurringConfirmScreen from './RecurringConfirmScreen';
import LimitsByCategoryScreen from './LimitsByCategoryScreen';   // ⬅️ NUEVO

// 🔔 Supabase + FCM
import { supabase } from './supabaseClient';
import messaging from '@react-native-firebase/messaging';
import { setupPushBasic } from './push'; // ⬅️ ÚNICA importación desde push.js

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { theme } = useTheme();
  const navRef = useNavigationContainerRef();

  // Guardamos el último token conocido aquí
  const tokenRef = useRef(null);

  // 💾 Guarda/actualiza token en Supabase
  const saveToken = async (token) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        console.log('⚠️ No hay sesión aún. Pendiente guardar token.');
        return;
      }

      // Detecta si estás en modo desarrollo o producción
      const environment = __DEV__ ? 'development' : 'production';

      const { error } = await supabase
        .from('user_devices')
        .upsert(
          {
            user_id: userId,
            token,
            platform: Platform.OS,
            environment,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,token' }
        );

      if (error) {
        console.log('❌ Error upsert user_devices:', error.message);
      } else {
        console.log('✅ Token guardado/actualizado en user_devices');
      }
    } catch (e) {
      console.log('❌ Excepción upsert user_devices:', e?.message);
    }
  };

  // === Registrar push y gestionar token ===
  useEffect(() => {
    let unsubOpen = () => {};
    let unsubRefresh = () => {};
    let authSub;

    (async () => {
      // 1) Configurar FCM
      const token = await setupPushBasic();
      tokenRef.current = token;

      // Diagnóstico iOS físico
      if (Platform.OS === 'ios') {
        try {
          await messaging().registerDeviceForRemoteMessages();
          const apnsToken = await messaging().getAPNSToken();
          console.log('🍏 APNS token iOS:', apnsToken || '(null)');
          await messaging().setAutoInitEnabled(true);
          const isReg = await messaging().isDeviceRegisteredForRemoteMessages();
          console.log('🍏 iOS registrado para remote messages:', isReg);
        } catch (e) {
          console.log('❌ Error APNs/autoInit:', e?.message);
        }
      }

      // 2) Guardar token si ya hay sesión
      if (token) {
        await saveToken(token);
      } else {
        console.log('⚠️ setupPushBasic no entregó token');
      }

      // 3) Cambios de sesión
      const authListener = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user && tokenRef.current) {
          console.log('🔐 Sesión lista; guardando token…');
          saveToken(tokenRef.current);
        }
      });
      authSub = authListener?.data?.subscription;

      // 4) Refresh de token
      unsubRefresh = messaging().onTokenRefresh(async (newToken) => {
        console.log('♻️ FCM token refresh:', newToken);
        tokenRef.current = newToken;
        await saveToken(newToken);
      });

      // 5) App en segundo plano → usuario toca notificación
      unsubOpen = messaging().onNotificationOpenedApp((remoteMessage) => {
        const screen = remoteMessage?.data?.screen;
        if (screen) navRef.current?.navigate(screen);
      });
    })();

    return () => {
      try { unsubOpen && unsubOpen(); } catch {}
      try { unsubRefresh && unsubRefresh(); } catch {}
      try { authSub && authSub.unsubscribe(); } catch {}
    };
  }, [navRef]);

  // === Navegar al tocar notificación con la app terminada ===
  useEffect(() => {
    (async () => {
      const initial = await messaging().getInitialNotification();
      const screen = initial?.data?.screen;
      if (screen) setTimeout(() => navRef.current?.navigate(screen), 200);
    })();
  }, [navRef]);

  // === Tema ===
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
      <NavigationContainer theme={navTheme} ref={navRef}>
        <Stack.Navigator
          initialRouteName="Welcome"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen
            name="LoginScreen"
            component={LoginScreen}
            options={{ headerShown: false, title: 'Iniciar sesión' }}
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
          <Stack.Screen
            name="GastoEntry"
            component={GastoEntryScreen}
            options={{ title: 'Nuevo Gasto' }}
          />
          <Stack.Screen
            name="TipoGasto"
            component={TipoGastoScreen}
            options={{ title: 'Tipos de Gasto' }}
          />
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
          {/* ⬇️ NUEVA PANTALLA DE TOPES POR CATEGORÍA */}
          <Stack.Screen
            name="LimitsByCategoryScreen"
            component={LimitsByCategoryScreen}
            options={{ title: 'Topes por categoría' }}
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
