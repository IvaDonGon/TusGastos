// RecurringExpensesScreen.js
// Crear gasto recurrente (solo con columnas existentes): user_id, nombre, monto, dia_pago, activo

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Switch,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

// =============== Utils ===============
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const digitsOnly = (v) => v.replace(/\D/g, '');

// Día de pago: permitir hasta 2 dígitos y limitar 1..31
const maskDiaPago = (raw) => {
  const d = digitsOnly(raw).slice(0, 2);
  return d;
};
const parseDiaPago = (v) => {
  if (!v) return null;
  const n = parseInt(v, 10);
  if (isNaN(n)) return null;
  return clamp(n, 1, 31);
};

export default function RecurringExpensesScreen({ navigation }) {
  const { theme } = useTheme();

  const [userId, setUserId] = useState(null);

  // Form
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [diaPagoStr, setDiaPagoStr] = useState('30'); // por defecto 30 (común para arriendos)
  const [activo, setActivo] = useState(true);

  // Tipos de gasto (UI opcional: hoy NO se guarda porque la tabla no tiene columna)
  const [tiposList, setTiposList] = useState([]); // [{ id, nombre }]
  const [tipoId, setTipoId] = useState(null);
  const [loadingTipos, setLoadingTipos] = useState(false);

  const [saving, setSaving] = useState(false);

  // 1) Obtener userId
  useEffect(() => {
    (async () => {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) {
        Alert.alert('Auth', error.message);
        return;
      }
      const id = sessionData?.session?.user?.id ?? null;
      setUserId(id);
      if (!id) {
        Alert.alert('Sesión requerida', 'Inicia sesión para crear gastos recurrentes.');
      }
    })();
  }, []);

  // 2) Cargar tipos activos del usuario (UI opcional)
  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    (async () => {
      setLoadingTipos(true);
      try {
        const { data, error } = await supabase
          .from('tipos_gastos')
          .select('id, nombre')
          .eq('user_id', userId)
          .eq('activo', true)
          .order('nombre', { ascending: true });

        if (error) throw error;

        if (!mounted) return;
        const lista = (data || [])
          .filter((t) => t?.nombre)
          .map((t) => ({ id: t.id, nombre: t.nombre }));

        setTiposList(lista);
      } catch (e) {
        if (!mounted) return;
        setTiposList([]);
        // No es crítico; solo informativo
        console.log('Tipos de gasto:', e.message ?? 'No se pudieron cargar los tipos.');
      } finally {
        if (mounted) setLoadingTipos(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const irAlDashboard = () => navigation.navigate('MainTabs', { screen: 'Home' });

  // Validaciones acotadas a la tabla actual
  const validar = () => {
    if (!nombre?.trim()) return 'Ingresa un nombre.';
    const montoNum = parseFloat(String(monto).replace(',', '.'));
    if (isNaN(montoNum) || montoNum <= 0) return 'El monto debe ser mayor a 0.';
    const dia = parseDiaPago(diaPagoStr);
    if (!dia || dia < 1 || dia > 31) return 'Ingresa un día de pago entre 1 y 31.';
    return null;
  };

  const guardar = async () => {
    const msg = validar();
    if (msg) {
      Alert.alert('Validación', msg);
      return;
    }
    if (!userId) {
      Alert.alert('Error', 'No hay sesión activa.');
      return;
    }

    const diaPago = parseDiaPago(diaPagoStr); // número 1..31 garantizado

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        nombre: nombre.trim(),
        monto: Number(String(monto).replace(',', '.')),
        dia_pago: diaPago,
        activo,
        // NOTA: no guardamos tipo/categoría porque la tabla no tiene esa columna todavía.
      };

      const { data, error } = await supabase
        .from('gastos_recurrentes')
        .insert([payload])
        .select('id')
        .maybeSingle();

      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }

      // (Opcional) Si ya tienes el RPC ensure_ocurrencias_mes, puedes llamarlo aquí para generar la ocurrencia del mes:
      // await supabase.rpc('ensure_ocurrencias_mes', {
      //   p_user_id: userId,
      //   p_date: new Date().toISOString().slice(0, 10),
      // });

      Alert.alert('Listo', 'Gasto recurrente creado.', [
        { text: 'OK', onPress: irAlDashboard },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Gasto recurrente</Text>

          {/* NOMBRE */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nombre</Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={theme.colors.text}
                style={{ marginRight: 8 }}
              />
              <TextInput
                placeholder="Ej: Arriendo, Luz, Internet"
                placeholderTextColor={theme.isDark ? '#888' : '#777'}
                value={nombre}
                onChangeText={setNombre}
                style={[styles.inputFlex, { color: theme.colors.text }]}
              />
            </View>
          </View>

          {/* MONTO */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Monto</Text>
            <View
              style={[
                styles.inputBigWrapper,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
              ]}
            >
              <TextInput
                placeholder="0.00"
                placeholderTextColor={theme.isDark ? '#888' : '#777'}
                keyboardType="decimal-pad"
                value={monto}
                onChangeText={setMonto}
                style={[styles.inputBig, { color: theme.colors.text }]}
              />
            </View>
          </View>

          {/* TIPO (UI opcional, no se persiste hoy) */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Tipo de gasto (opcional)</Text>
            <View style={styles.pillRow}>
              {(tiposList ?? []).map((t) => {
                const selected = tipoId === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.pill,
                      { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
                      selected && { backgroundColor: theme.isDark ? '#fff' : '#000' },
                    ]}
                    onPress={() => setTipoId(t.id)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: theme.colors.text },
                        selected && { color: theme.isDark ? '#000' : '#fff', fontWeight: '800' },
                      ]}
                    >
                      {t.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {loadingTipos && <ActivityIndicator style={{ marginLeft: 6 }} />}
              {!loadingTipos && (tiposList ?? []).length === 0 && (
                <Text style={{ color: theme.colors.text, opacity: 0.7 }}>
                  Aún no tienes tipos de gasto activos.
                </Text>
              )}
            </View>
            <Text style={{ color: theme.colors.text, opacity: 0.6, marginTop: 6, fontSize: 12 }}>
              *Por ahora esto no se guarda en la tabla; lo integramos cuando agreguemos categoría.
            </Text>
          </View>

          {/* DÍA DE PAGO */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Día de pago (1–31)</Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={theme.colors.text}
                style={{ marginRight: 8 }}
              />
              <TextInput
                placeholder="30"
                placeholderTextColor={theme.isDark ? '#888' : '#777'}
                value={diaPagoStr}
                onChangeText={(v) => setDiaPagoStr(maskDiaPago(v))}
                keyboardType="number-pad"
                maxLength={2}
                style={[styles.inputFlex, { color: theme.colors.text }]}
              />
            </View>
            <Text style={{ color: theme.colors.text, opacity: 0.6, marginTop: 6, fontSize: 12 }}>
              Si el mes tiene menos días (p. ej., febrero), se ajustará al último día del mes.
            </Text>
          </View>

          {/* ACTIVO */}
          <View style={[styles.fieldBlock, styles.switchRow]}>
            <Text style={[styles.label, { color: theme.colors.text, marginBottom: 0 }]}>
              Activo
            </Text>
            <Switch value={activo} onValueChange={setActivo} />
          </View>

          {/* NOTA INFO */}
          <Text
            style={{
              color: theme.colors.text,
              opacity: 0.6,
              fontSize: 12,
              marginBottom: 140,
            }}
          >
            Consejo: define tus tipos en “Tipos de Gasto” (hoy solo visual).
          </Text>
        </ScrollView>

        {/* BOTONES FIJOS */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={guardar}
            disabled={saving || loadingTipos}
            style={[
              styles.btnPrimary,
              { backgroundColor: theme.isDark ? '#fff' : '#000', opacity: saving ? 0.7 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
            ) : (
              <Text style={[styles.btnText, { color: theme.isDark ? '#000' : '#fff' }]}>
                Guardar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btnSecondary]} onPress={irAlDashboard}>
            <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* =======================
   ESTILOS
   ======================= */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { paddingHorizontal: 22, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 16, textAlign: 'center' },

  fieldBlock: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputFlex: { flex: 1, fontSize: 16 },

  inputBigWrapper: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 },
  inputBig: { fontSize: 30, fontWeight: '800', paddingVertical: 4 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  pillText: { fontSize: 14 },

  switchRow: {
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  footer: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 0.3,
    borderTopColor: '#ccc',
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  btnText: { fontSize: 16, fontWeight: '800' },
});
