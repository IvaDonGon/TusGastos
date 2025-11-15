// push.js
import { Platform, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';

/**
 * Configura FCM:
 * - iOS: registra el dispositivo y define presentación en foreground
 * - Pide permisos (iOS)
 * - Obtiene el token (y escucha onTokenRefresh)
 * - Se suscribe al topic global
 * - Muestra alerta en foreground
 */
export async function setupPushBasic() {
  try {
    // === iOS: registro + cómo mostrar notificaciones en foreground ===
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();

      // IMPORTANTE: esto permite ver alertas con la app abierta
      await messaging().setForegroundNotificationPresentationOptions({
        alert: true,
        badge: true,
        sound: true,
      });

      // Log de diagnóstico APNs
      try {
        const apnsToken = await messaging().getAPNSToken();
        console.log('🍏 APNS token iOS:', apnsToken || '(null)');
      } catch (e) {
        console.log('❌ Error obteniendo APNS token:', e?.message);
      }
    }

    // 1️⃣ Pedir permiso (iOS)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    console.log('🔐 Permiso notificaciones (iOS):', authStatus, 'enabled:', enabled);

    if (!enabled) {
      console.log('🔕 Permiso de notificaciones denegado/provisional no activo');
      return null;
    }

    // 2️⃣ Obtener token FCM
    let token = await messaging().getToken();

    if (!token) {
      // En simulador no hay token real
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        token = `SIMULATOR_FAKE_TOKEN_${Platform.OS?.toUpperCase() || 'WEB'}`;
      }
      console.log(token ? '⚙️ Token simulado:' : '⚠️ No se obtuvo token FCM');
    } else {
      console.log('🔥 FCM Token:', token);
    }

    // 2.1️⃣ Si FCM rota el token, lo capturamos
    messaging().onTokenRefresh(async (newToken) => {
      console.log('♻️ FCM token refresh:', newToken);
      // Aquí NO guardamos a DB (lo haces en App.js), solo devolvemos el token inicial
      // El guardado centralizado en App.js ya lo maneja al escuchar onTokenRefresh también (si lo tienes).
    });

    // 3️⃣ Suscribirse al tópico "all-users" (opcional)
    try {
      await messaging().subscribeToTopic('all-users');
      console.log('📡 Suscrito al tópico all-users');
    } catch (e) {
      console.log('⚠️ Error al suscribirse al tópico:', e?.message);
    }

    // 4️⃣ Listener en foreground (app abierta)
    messaging().onMessage(async (remoteMessage) => {
      console.log('📬 Notificación (foreground):', remoteMessage);
      const title =
        remoteMessage?.notification?.title ||
        remoteMessage?.data?.title ||
        'Notificación';
      const body =
        remoteMessage?.notification?.body ||
        remoteMessage?.data?.body ||
        'Tienes un mensaje nuevo';
      Alert.alert(title, body);
    });

    // 5️⃣ Listener cuando se abre la app tocando la notificación (background → foreground)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📲 Notificación abrió app (background):', remoteMessage);
    });

    // 6️⃣ Mensaje que abrió la app desde "quit"
    const initial = await messaging().getInitialNotification();
    if (initial) {
      console.log('🚀 App abierta desde notificación (quit):', initial);
    }

    return token || null;
  } catch (err) {
    console.log('❌ Error en setupPushBasic:', err?.message || err);
    return null;
  }
}
