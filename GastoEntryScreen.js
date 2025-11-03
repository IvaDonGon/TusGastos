import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

// ===============================
// Utilidades de fecha
// ===============================
const isoToUI = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const uiToISO = (ui) => {
  if (!ui) return '';
  const [d, m, y] = String(ui).split('/');
  return `${y}-${m}-${d}`;
};
const maskDDMMYYYY = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
const isValidUIDate = (v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v);

export default function GastoEntryScreen({ navigation, route }) {
  const { theme } = useTheme();
  const gastoEditar = route?.params?.gasto ?? null;

  const [userId, setUserId] = useState(null);

  const [fechaUI, setFechaUI] = useState(
    gastoEditar?.fecha ? isoToUI(gastoEditar.fecha) : isoToUI(new Date().toISOString())
  );

  // NUEVO: usar tipoId (FK) y lista [{id,nombre}]
  const [tipoId, setTipoId] = useState(gastoEditar?.id_tipo_gasto ?? null);
  const [tiposList, setTiposList] = useState([]); // [{ id, nombre }]

  const [total, setTotal] = useState(
    typeof gastoEditar?.total === 'number' ? String(gastoEditar.total) : ''
  );
  const [nota, setNota] = useState(gastoEditar?.nota ?? '');

  const [loading, setLoading] = useState(false); // carga de tipos
  const [saving, setSaving] = useState(false);

  const esEdicion = useMemo(() => !!gastoEditar, [gastoEditar]);

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
    })();
  }, []);

  // 2) Cargar tipos (activos) y considerar el del gasto en edición aunque esté inactivo
  useEffect(() => {
    if (!userId) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Traer tipos activos
        const { data: activos, error: errAct } = await supabase
          .from('tipos_gastos')
          .select('id, nombre')
          .eq('user_id', userId)
          .eq('activo', true)
          .order('nombre', { ascending: true });
        if (errAct) throw errAct;

        let tipos = (activos || [])
          .map((t) => ({ id: t.id, nombre: t.nombre }))
          .filter((t) => t.nombre);

        // Si edito y tengo tipo_id inactivo, lo traigo explícito para mostrarlo seleccionado
        if (esEdicion && gastoEditar?.id_tipo_gasto) {
          const existe = tipos.some((t) => t.id === gastoEditar.id_tipo_gasto);
          if (!existe) {
            const { data: inactivo, error: errIn } = await supabase
              .from('tipos_gastos')
              .select('id, nombre')
              .eq('user_id', userId)
              .eq('id', gastoEditar.id_tipo_gasto)
              .maybeSingle();
            if (!errIn && inactivo) {
              tipos = [{ id: inactivo.id, nombre: inactivo.nombre }, ...tipos];
            }
          }
        }

        // Si vengo de esquema viejo (sin tipo_id) pero con nombre: intento mapear
        if (!tipoId && esEdicion && gastoEditar?.tipo) {
          const byName = tipos.find(
            (t) => String(t.nombre).toLowerCase() === String(gastoEditar.tipo).toLowerCase()
          );
          if (byName) setTipoId(byName.id);
        }

        if (!mounted) return;
        setTiposList(Array.isArray(tipos) ? tipos : []);
      } catch (e) {
        if (!mounted) return;
        setTiposList([]); // aseguramos array
        Alert.alert('Tipos de gasto', e.message ?? 'No se pudieron cargar los tipos.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, esEdicion, gastoEditar?.tipo_id, gastoEditar?.tipo, tipoId]);

  const validar = () => {
    if (!isValidUIDate(fechaUI)) return 'Formato de fecha inválido (DD/MM/YYYY).';
    if (!tipoId) return 'Debes seleccionar un tipo.';
    const monto = parseFloat(String(total).replace(',', '.'));
    if (isNaN(monto) || monto <= 0) return 'El total debe ser mayor a 0.';
    return null;
  };

  // 🔙 (faltaba en tu código previo)
  const irAlDashboard = () => navigation.navigate('MainTabs', { screen: 'Home' });

  const guardar = async () => {
    const msg = validar();
    if (msg) {
      Alert.alert('Validación', msg);
      return;
    }

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        Alert.alert('Error', 'No hay sesión activa.');
        setSaving(false);
        return;
      }

      const payload = {
        user_id: uid,
        fecha: uiToISO(fechaUI),
        id_tipo_gasto: tipoId,
        total: parseFloat(String(total).replace(',', '.')),
        nota: nota?.trim() || null,
      };

      let error;
      if (esEdicion) {
        ({ error } = await supabase
          .from('gastos')
          .update(payload)
          .eq('id', gastoEditar.id)
          .eq('user_id', uid));
      } else {
        ({ error } = await supabase.from('gastos').insert(payload));
      }

      if (error) {
        Alert.alert('Error', error.message);
        setSaving(false);
        return;
      }

      Alert.alert('Listo', esEdicion ? 'Gasto actualizado.' : 'Gasto registrado.', [
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
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {esEdicion ? 'Editar gasto' : 'Nuevo gasto'}
          </Text>

          {/* FECHA */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Fecha</Text>
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
                placeholder="19/10/2025"
                placeholderTextColor={theme.isDark ? '#888' : '#777'}
                value={fechaUI}
                onChangeText={(v) => setFechaUI(maskDDMMYYYY(v))}
                keyboardType="number-pad"
                maxLength={10}
                style={[styles.inputFlex, { color: theme.colors.text }]}
              />
            </View>
          </View>

          {/* TIPO (desde tipos_gastos) */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Tipo</Text>
            <View style={styles.pillRow}>
              {(tiposList ?? []).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
                    tipoId === t.id && { backgroundColor: theme.isDark ? '#fff' : '#000' },
                  ]}
                  onPress={() => setTipoId(t.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: theme.colors.text },
                      tipoId === t.id && { color: theme.isDark ? '#000' : '#fff', fontWeight: '800' },
                    ]}
                  >
                    {t.nombre}
                  </Text>
                </TouchableOpacity>
              ))}

              {loading && <ActivityIndicator style={{ marginLeft: 6 }} />}
              {!loading && (tiposList ?? []).length === 0 && (
                <Text style={{ color: theme.colors.text, opacity: 0.7 }}>
                  Aún no tienes tipos de gasto activos.
                </Text>
              )}
            </View>
          </View>

          {/* TOTAL */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Total</Text>
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
                value={total}
                onChangeText={setTotal}
                style={[styles.inputBig, { color: theme.colors.text }]}
              />
            </View>
          </View>

          {/* NOTA */}
          <View style={{ marginBottom: 140 }}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Nota (opcional)</Text>
            <TextInput
              placeholder="Detalle del gasto..."
              placeholderTextColor={theme.isDark ? '#888' : '#777'}
              multiline
              value={nota}
              onChangeText={setNota}
              style={[
                styles.textarea,
                { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6', color: theme.colors.text },
              ]}
            />
          </View>
        </ScrollView>

        {/* BOTONES FIJOS: GUARDAR ARRIBA / CANCELAR ABAJO */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={guardar}
            disabled={saving}
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

          <TouchableOpacity
            style={[
              styles.btnSecondary,
             
            ]}
            onPress={irAlDashboard}
          >
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
  textarea: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  pillText: { fontSize: 14 },

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
