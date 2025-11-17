// SettingsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

Ionicons.loadFont();

/** Item de navegación en grupo tipo lista */
function NavItem({ icon, title, subtitle, onPress, theme, disabled }) {
  const handlePress = () => {
    if (disabled) return;
    onPress && onPress();
  };

  return (
    <TouchableOpacity
      style={[
        styles.navItem,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: theme.isDark ? '#ffffff22' : '#eaeaea',
          borderBottomWidth: 1,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <View
        style={[
          styles.navIconBox,
          { backgroundColor: theme.isDark ? '#ffffff14' : '#00000012' },
        ]}
      >
        <Ionicons name={icon} size={20} color={theme.isDark ? '#fff' : '#000'} />
      </View>
      <View style={styles.navTextBox}>
        <Text style={[styles.navTitle, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.navSubtitle, { color: theme.colors.text }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.isDark ? '#fff' : '#000'}
      />
    </TouchableOpacity>
  );
}

/** Card de acción (para cerrar sesión) */
function CardAction({ icon, label, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: theme.colors.card }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View
        style={[
          styles.actionIcon,
          { backgroundColor: theme.isDark ? '#ffffff14' : '#00000010' },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={theme.isDark ? '#fff' : '#000'}
        />
      </View>
      <Text
        style={[
          styles.actionLabel,
          { color: theme.colors.text },
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={theme.isDark ? '#fff' : '#000'}
      />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { theme, toggleTheme } = useTheme();

  // Perfil
  const [perfil, setPerfil] = useState(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  // Preferencias locales
  const [notificaciones, setNotificaciones] = useState(false);
  const [saving, setSaving] = useState(false);

  // Topes por tipo de gasto
  const [limitsByCategoryEnabled, setLimitsByCategoryEnabled] = useState(false);
  const [notifyAtPercent, setNotifyAtPercent] = useState(80);
  const [userId, setUserId] = useState(null);

    // 🆕 Preferencia: respaldar gasto con foto
  const [receiptBackupEnabled, setReceiptBackupEnabled] = useState(false);

  // =========================
  // Cargar perfil + settings
  // =========================
  const cargarPerfilYSettings = useCallback(async () => {
    try {
      setLoadingPerfil(true);

      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const user = sessionData?.session?.user;
      if (!user) {
        setPerfil(null);
        return;
      }
      setUserId(user.id);

      const { data: perfilData, error: perfilErr } = await supabase
        .from('usuarios')
        .select('nombre, email, limits_by_category_enabled, notify_at_percent,receipt_backup_enabled')
        .eq('id', user.id)
        .maybeSingle();

      if (perfilErr) throw perfilErr;

      if (perfilData) {
        setPerfil({ nombre: perfilData.nombre, email: perfilData.email });

        if (typeof perfilData.limits_by_category_enabled === 'boolean') {
          setLimitsByCategoryEnabled(perfilData.limits_by_category_enabled);
        }
        if (typeof perfilData.notify_at_percent === 'number') {
          setNotifyAtPercent(perfilData.notify_at_percent);
        }

         // 🆕 cargar preferencia de respaldo de gastos
        if (typeof perfilData.receipt_backup_enabled === 'boolean') {
          setReceiptBackupEnabled(perfilData.receipt_backup_enabled);
        } else {
          setReceiptBackupEnabled(false);
        }
      } else {
        setPerfil(null);
        setLimitsByCategoryEnabled(false);
        setNotifyAtPercent(80);
        setReceiptBackupEnabled(false);
      }
    } catch (err) {
      console.log('cargarPerfilYSettings error:', err);
      Alert.alert('Error', 'No se pudo cargar el perfil y la configuración.');
    } finally {
      setLoadingPerfil(false);
    }
  }, []);

  useEffect(() => {
    cargarPerfilYSettings();
  }, [cargarPerfilYSettings]);

  // =========================
  // Guardar topes por categoría
  // =========================
  const saveLimitsByCategory = useCallback(
    async (nextEnabled) => {
      if (!userId) return;

      try {
        setSaving(true);
        const { error } = await supabase
          .from('usuarios')
          .update({
            limits_by_category_enabled: nextEnabled,
            notify_at_percent: notifyAtPercent,
          })
          .eq('id', userId);

        if (error) throw error;
      } catch (err) {
        console.log('saveLimitsByCategory error:', err);
        Alert.alert('Error', 'No se pudo guardar la configuración.');
        setLimitsByCategoryEnabled((prev) => !prev); // revertir si falla
      } finally {
        setSaving(false);
      }
    },
    [userId, notifyAtPercent]
  );

  const onToggleLimits = useCallback(() => {
    const next = !limitsByCategoryEnabled;
    setLimitsByCategoryEnabled(next); // UI optimista
    saveLimitsByCategory(next);
  }, [limitsByCategoryEnabled, saveLimitsByCategory]);



  // =========================
  // 🆕 Guardar preferencia de respaldo con foto
  // =========================
  const saveReceiptBackup = useCallback(
    async (nextEnabled) => {
      if (!userId) return;

      try {
        setSaving(true);
        const { error } = await supabase
          .from('usuarios')
          .update({
            receipt_backup_enabled: nextEnabled,
          })
          .eq('id', userId);

        if (error) throw error;
      } catch (err) {
        console.log('saveReceiptBackup error:', err);
        Alert.alert('Error', 'No se pudo guardar la configuración de respaldo.');
        setReceiptBackupEnabled((prev) => !prev); // revertir si falla
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  const onToggleReceiptBackup = useCallback(() => {
    const next = !receiptBackupEnabled;
    setReceiptBackupEnabled(next); // UI optimista
    saveReceiptBackup(next);
  }, [receiptBackupEnabled, saveReceiptBackup]);


  // =========================
  // Logout
  // =========================
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    navigation.replace('LoginScreen');
  };

  // Iniciales para el avatar
  const getIniciales = (nombre = '') => {
    const partes = nombre.trim().split(' ').filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (
      partes[0].charAt(0).toUpperCase() +
      partes[partes.length - 1].charAt(0).toUpperCase()
    );
  };

  // =========================
  // Render
  // =========================
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {loadingPerfil ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={{ marginTop: 10, color: theme.colors.text }}>
            Cargando...
          </Text>
        </View>
      ) : perfil ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar / encabezado */}
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.isDark ? '#fff' : '#000' },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: theme.isDark ? '#000' : '#fff' },
                ]}
              >
                {getIniciales(perfil.nombre)}
              </Text>
            </View>
            <Text style={[styles.name, { color: theme.colors.text }]}>
              {perfil.nombre}
            </Text>
            <Text style={[styles.email, { color: theme.colors.text }]}>
              {perfil.email}
            </Text>

            {/* Botón Editar perfil */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: theme.isDark ? '#ffffff' : '#000000' },
              ]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EditProfileScreen')}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.isDark ? '#000000' : '#ffffff' },
                ]}
              >
                Editar perfil
              </Text>
            </TouchableOpacity>
          </View>

          {/* Preferencias */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Preferencias
          </Text>

          {/* Notificaciones */}
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: theme.isDark ? '#ffffff14' : '#00000010' },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={theme.isDark ? '#fff' : '#000'}
              />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Envío de notificaciones
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.text }]}>
                Recibe alertas importantes y recordatorios
              </Text>
            </View>
            <Switch
              value={notificaciones}
              onValueChange={setNotificaciones}
              trackColor={{ false: '#aaa', true: '#000' }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>

          {/* Modo oscuro */}
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: theme.isDark ? '#ffffff14' : '#00000010' },
              ]}
            >
              <Ionicons
                name="moon-outline"
                size={20}
                color={theme.isDark ? '#fff' : '#000'}
              />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Modo oscuro
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.text }]}>
                Cambia el tema de toda la aplicación
              </Text>
            </View>
            <Switch
              value={theme.isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#aaa', true: '#000' }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>

                  {/* 🆕 Respaldar gastos con foto */}
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View
              style={[
                styles.cardIconBox,
                { backgroundColor: theme.isDark ? '#ffffff14' : '#00000010' },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={20}
                color={theme.isDark ? '#fff' : '#000'}
              />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Respaldar gastos con foto
              </Text>
              <Text style={[styles.cardSubtitle, { color: theme.colors.text }]}>
                Te pediremos la foto del comprobante al registrar un gasto.
              </Text>
            </View>
            <Switch
              value={receiptBackupEnabled}
              onValueChange={onToggleReceiptBackup}
              disabled={saving}
              trackColor={{
                false: '#aaa',
                true: theme.isDark ? '#ffffff55' : '#00000066',
              }}
              thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
            />
          </View>

          {/* Topes por tipo de gasto */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                flexDirection: 'column',
                alignItems: 'stretch',
              },
            ]}
          >
            <View style={styles.cardRow}>
              <View
                style={[
                  styles.cardIconBox,
                  { backgroundColor: theme.isDark ? '#ffffff14' : '#00000010' },
                ]}
              >
                <Ionicons
                  name="wallet-outline"
                  size={20}
                  color={theme.isDark ? '#fff' : '#000'}
                />
              </View>
              <View style={styles.cardTextContainer}>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                  Presupuesto por gastos
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.text }]}>
                  Define límites mensuales por categoría.
                </Text>
              </View>
              <Switch
                value={limitsByCategoryEnabled}
                onValueChange={onToggleLimits}
                disabled={saving}
                trackColor={{
                  false: '#aaa',
                  true: theme.isDark ? '#ffffff55' : '#00000066',
                }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
              />
            </View>
          </View>

          {/* Card separada para configurar topes */}
          <View style={[styles.navGroup, { marginTop: 8 }]}>
            <NavItem
              icon="options-outline"
              title="Configurar tu presupuesto"
              subtitle={
                limitsByCategoryEnabled
                  ? 'Edita los montos máximos por tipo de gasto'
                  : 'Activa los topes para poder configurarlos'
              }
              disabled={!limitsByCategoryEnabled}
              onPress={() => {
                if (!limitsByCategoryEnabled) {
                  Alert.alert(
                    'Topes por tipo de gasto',
                    'Primero activa la opción de topes por tipo de gasto.'
                  );
                  return;
                }
                navigation.navigate('LimitsByCategoryScreen');
              }}
              theme={theme}
            />
          </View>

          {/* Mantenedores */}
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text, marginTop: 18 },
            ]}
          >
            Mantenedores
          </Text>
          <View style={[styles.navGroup]}>
            <NavItem
              icon="pricetags-outline"
              title="Tipos de gasto"
              subtitle="Administra tus categorías personalizadas"
              onPress={() => navigation.navigate('TipoGasto')}
              theme={theme}
            />
          </View>

          {/* Cuenta / Cerrar sesión */}
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.text, marginTop: 26 },
            ]}
          >
            Cuenta
          </Text>

          <CardAction
            icon="log-out-outline"
            label="Cerrar sesión"
            onPress={handleLogout}
            theme={theme}
          />
        </ScrollView>
      ) : (
        <View style={styles.loadingBox}>
          <Text style={{ color: theme.colors.text }}>No hay sesión activa.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120, // espacio para que nada quede tapado
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: '600' },
  email: { fontSize: 15 },

  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },

  card: {
    borderRadius: 14,
    padding: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTextContainer: {
    flex: 1,
    paddingRight: 6,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, opacity: 0.7 },

  // Botón primario (Editar perfil)
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Navegación tipo lista
  navGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  navIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextBox: { flex: 1 },
  navTitle: { fontSize: 16, fontWeight: '600' },
  navSubtitle: { fontSize: 12, opacity: 0.6 },

  // Card acción (Cerrar sesión)
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});
