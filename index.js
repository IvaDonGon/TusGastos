/**
 * @format
 * Archivo de entrada principal para React Native
 * Configura FCM para manejar notificaciones en segundo plano
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import 'react-native-url-polyfill/auto';

// ============================================================
// 🔔 Manejo de mensajes en segundo plano o app terminada
// ============================================================
// Este listener se activa cuando la app está:
//   - cerrada (quit)
//   - en segundo plano
//   - y recibe una notificación push (sin que el usuario la toque aún)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📩 Push recibido en segundo plano:', {
    messageId: remoteMessage?.messageId,
    data: remoteMessage?.data,
    notification: remoteMessage?.notification,
  });

  // Si deseas mostrar una notificación local aquí, puedes usar `notifee`
  // o `react-native-push-notification` (opcional).
  // Ejemplo: mostrar banner personalizado si el dispositivo no lo hace automáticamente.
});

// ============================================================
// 📲 Registrar el componente principal
// ============================================================
AppRegistry.registerComponent(appName, () => App);
