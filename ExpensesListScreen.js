// ExpensesListScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl,
  TouchableOpacity, SafeAreaView, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Lucide from 'lucide-react-native';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

const TABLE_TIPOS = 'tipos_gastos';

// ---------- helpers ----------
const formatCLP = (n) => {
  const num = Number(n || 0);
  const s = Math.round(num).toString();
  return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
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

export default function ExpensesListScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { filterTipoGastoId = null, filterTipoGastoNombre = null } = route.params ?? {};

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);

  // TIPOS
  const [tipos, setTipos] = useState([]); // [{id: string, nombre: string}]
  const [tiposLoading, setTiposLoading] = useState(false);

  // MODAL EDICIÓN
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos del modal
  const [editId, setEditId] = useState(null); // string SIEMPRE
  const [fechaUI, setFechaUI] = useState(isoToUI(new Date().toISOString()));
  const [tipoId, setTipoId] = useState(null); // string (uuid) o null
  const [total, setTotal] = useState('');
  const [nota, setNota] = useState('');

  // ---------- cargar gastos ----------
  const fetchGastos = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setItems([]); return; }

      let query = supabase
        .from('gastos')
        .select('id, fecha, id_tipo_gasto, tipo, total, nota')
        .eq('user_id', user.id)
        .order('fecha', { ascending: false })
        .limit(500);

      if (filterTipoGastoId) {
        query = query.eq('id_tipo_gasto', String(filterTipoGastoId));
      }

      const { data, error } = await query;

      if (error) {
        console.log('Error listando gastos:', error.message);
        setItems([]);
      } else {
        setItems((data || []).map((g) => ({
          id: String(g.id),                         // <- forzamos string (uuid o int)
          fecha: g.fecha,
          id_tipo_gasto: g.id_tipo_gasto ? String(g.id_tipo_gasto) : null, // <- string
          tipo: g.tipo ?? null,
          total: Number(g.total || 0),
          nota: g.nota ? String(g.nota).trim() : '',
        })));
      }
    } catch (e) {
      console.log('Excepción listando gastos:', e?.message);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, filterTipoGastoId]);

  // ---------- cargar tipos ----------
  const fetchTipos = useCallback(async () => {
    try {
      setTiposLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { setTipos([]); return; }

      const { data, error } = await supabase
        .from(TABLE_TIPOS)
        .select('id, nombre')
        .eq('user_id', user.id)
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) {
        console.log('Error cargando tipos:', error.message);
        setTipos([]);
      } else {
        setTipos((data || []).map((t) => ({
          id: String(t.id),                // <- string (si es uuid, queda ok)
          nombre: String(t.nombre).trim(),
        })));
      }
    } catch (e) {
      console.log('Excepción cargando tipos:', e?.message);
      setTipos([]);
    } finally {
      setTiposLoading(false);
    }
  }, []);

  useEffect(() => { fetchGastos(); fetchTipos(); }, [fetchGastos, fetchTipos, filterTipoGastoId]);
  useFocusEffect(useCallback(() => { fetchGastos(); fetchTipos(); }, [fetchGastos, fetchTipos, filterTipoGastoId]));
  const onRefresh = useCallback(() => { setRefreshing(true); Promise.all([fetchGastos(), fetchTipos()]); }, [fetchGastos, fetchTipos]);

  // ---------- helpers UI ----------
  const getTipoNombre = useCallback((item) => {
    if (item.id_tipo_gasto) {
      const t = tipos.find((x) => x.id === item.id_tipo_gasto);
      if (t) return t.nombre;
    }
    if (item.tipo) return item.tipo;
    return 'Gasto';
  }, [tipos]);

  // ---------- abrir modal ----------
  const openEdit = (item) => {
    setEditId(String(item.id));                 // <- string
    setFechaUI(isoToUI(item.fecha));
    setTotal(item.total?.toString() || '');
    setNota(item.nota || '');
    if (item.id_tipo_gasto) {
      setTipoId(String(item.id_tipo_gasto));    // <- string
    } else if (item.tipo) {
      const byName = tipos.find((t) => t.nombre.toLowerCase() === String(item.tipo).toLowerCase());
      setTipoId(byName ? String(byName.id) : null);
    } else {
      setTipoId(null);
    }
    setEditVisible(true);
  };

  // ---------- eliminar ----------
  const removeItem = async (id) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) { Alert.alert('Eliminar', 'Sesión no encontrada.'); return; }

      const { error } = await supabase
        .from('gastos')
        .delete()
        .eq('id', String(id)) // <- string
        .eq('user_id', user.id);

      if (error) {
        console.log('Error eliminando gasto:', error.message);
        Alert.alert('Eliminar', 'No se pudo eliminar.');
      } else {
        setItems((prev) => prev.filter((it) => it.id !== String(id)));
      }
    } catch (e) {
      console.log('Excepción eliminando gasto:', e?.message);
      Alert.alert('Eliminar', 'Error inesperado.');
    }
  };

  const confirmRemove = (id) => {
    Alert.alert('Eliminar gasto', '¿Seguro que quieres eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeItem(id) },
    ]);
  };

  // ---------- validar & guardar ----------
  const validar = () => {
    if (!isValidUIDate(fechaUI)) return 'Formato de fecha inválido (DD/MM/YYYY).';
    if (!tipoId) return 'Debes seleccionar un tipo.';
    const monto = parseFloat(String(total).replace(',', '.'));
    if (isNaN(monto) || monto <= 0) return 'El total debe ser mayor a 0.';
    return null;
  };

  const saveEdit = async () => {
    const msg = validar();
    if (msg) return Alert.alert('Validación', msg);

    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) { Alert.alert('Error', 'No hay sesión activa.'); setSaving(false); return; }

      const payload = {
        user_id: uid,
        fecha: uiToISO(fechaUI),
        id_tipo_gasto: tipoId ? String(tipoId) : null,   // <- string o null (UUID compatible)
        total: parseFloat(String(total).replace(',', '.')),
        nota: nota?.trim() || null,
        tipo: null, // opcional: si migraste a FK, limpias el campo texto
      };

      const { error } = await supabase
        .from('gastos')
        .update(payload)
        .eq('id', String(editId))   // <- string
        .eq('user_id', uid);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        // refresco local
        const nuevaFechaISO = uiToISO(fechaUI);
        const totalNum = parseFloat(String(total).replace(',', '.'));
        setItems((prev) =>
          prev.map((it) =>
            it.id === String(editId)
              ? { ...it, fecha: nuevaFechaISO, id_tipo_gasto: tipoId ? String(tipoId) : null, tipo: null, total: totalNum, nota: nota?.trim() || '' }
              : it
          )
        );
        setEditVisible(false);
      }
    } catch (e) {
      Alert.alert('Error', e.message ?? 'Error inesperado.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- render fila ----------
  const renderItem = ({ item }) => {
    const titulo = getTipoNombre(item);
    const sub = `${isoToUI(item.fecha)}${item.nota ? ' • ' + item.nota : ''}`;

    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => openEdit(item)} style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
          <Ionicons name="receipt-outline" size={18} color={theme.isDark ? '#000' : '#fff'} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>{titulo}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text, opacity: 0.7 }]} numberOfLines={1}>{sub}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amount, { color: theme.colors.text }]}>{formatCLP(item.total)}</Text>
          <TouchableOpacity onPress={() => confirmRemove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={20} color={theme.isDark ? '#ff5c5c' : '#cc0000'} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------- UI ----------
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {filterTipoGastoNombre ? `Gastos • ${filterTipoGastoNombre}` : 'Todos los gastos'}
        </Text>
      </View>

      {/* Chip de filtro + botón limpiar */}
      {filterTipoGastoId && (
        <View style={styles.filterRow}>
          <View style={[styles.filterChip, { borderColor: theme.isDark ? '#fff' : '#000' }]}>
            <Lucide.Tag size={14} color={theme.colors.text} />
            <Text style={[styles.filterText, { color: theme.colors.text }]} numberOfLines={1}>
              {filterTipoGastoNombre}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.setParams({ filterTipoGastoId: null, filterTipoGastoNombre: null })}
            style={[styles.clearBtn, { borderColor: theme.isDark ? '#fff' : '#000' }]}
          >
            <Text style={[styles.clearText, { color: theme.colors.text }]}>Quitar filtro</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista */}
      {loading && !refreshing ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, marginTop: 8 }}>Cargando...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.text} />}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.text, opacity: 0.7, marginTop: 20, textAlign: 'center' }}>
              {filterTipoGastoId ? 'No hay gastos para este tipo.' : 'No tienes gastos registrados.'}
            </Text>
          }
        />
      )}

      {/* botón volver */}
      <View style={styles.footerList}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={[styles.btnSecondary, { backgroundColor: theme.isDark ? '#fff' : '#000' }]}>
          <Text style={[styles.btnText, { color: theme.isDark ? '#000' : '#fff' }]}>Volver</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL de edición */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
              <Text style={[styles.titleModal, { color: theme.colors.text }]}>Editar gasto</Text>

              {/* FECHA */}
              <View style={styles.fieldBlock}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Fecha</Text>
                <View style={[styles.inputRow, { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' }]}>
                  <Ionicons name="calendar-outline" size={20} color={theme.colors.text} style={{ marginRight: 8 }} />
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

              {/* TIPO (chips) */}
              <View style={styles.fieldBlock}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Tipo</Text>
                <View style={styles.pillRow}>
                  {(tipos ?? []).map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.pill,
                        { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' },
                        tipoId === t.id && { backgroundColor: theme.isDark ? '#fff' : '#000' },
                      ]}
                      onPress={() => setTipoId(String(t.id))}
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
                  {tiposLoading && <ActivityIndicator style={{ marginLeft: 6 }} />}
                  {!tiposLoading && (tipos ?? []).length === 0 && (
                    <Text style={{ color: theme.colors.text, opacity: 0.7 }}>
                      Aún no tienes tipos de gasto activos.
                    </Text>
                  )}
                </View>
              </View>

              {/* TOTAL */}
              <View style={styles.fieldBlock}>
                <Text style={[styles.label, { color: theme.colors.text }]}>Total</Text>
                <View style={[styles.inputBigWrapper, { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6' }]}>
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
                  style={[styles.textarea, { backgroundColor: theme.isDark ? '#1b1b1b' : '#f6f6f6', color: theme.colors.text }]}
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={saving}
                style={[styles.btnPrimary, { backgroundColor: theme.isDark ? '#fff' : '#000', opacity: saving ? 0.7 : 1 }]}
              >
                {saving ? <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} /> :
                  <Text style={[styles.btnText, { color: theme.isDark ? '#000' : '#fff' }]}>Guardar</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.btnSecondary2, { backgroundColor: '#f0f0f0' }]} onPress={() => setEditVisible(false)}>
                <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    alignItems: 'center',
    marginTop: 34,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },

  filterRow: {
    paddingHorizontal: 16,marginTop: 15, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10,
  },
  filterText: { fontSize: 12, fontWeight: '700' },
  clearBtn: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10,
  },
  clearText: { fontSize: 12, fontWeight: '700' },

  // Tarjeta de gasto
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
    elevation: 1,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 1 },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 6 },
  deleteBtn: { marginTop: 4, paddingVertical: 2, paddingHorizontal: 6 },

  center: { alignItems: 'center', justifyContent: 'center' },

  // Footer (botón Volver)
  footerList: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 16,
    backgroundColor: 'transparent',
    marginBottom: 40,
  },
  btnSecondary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  btnSecondary2: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { fontSize: 15, fontWeight: '700' },

  // Modal
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    paddingTop: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
  },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 6 },
  titleModal: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' },

  fieldBlock: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputFlex: { flex: 1, fontSize: 15 },
  inputBigWrapper: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  inputBig: { fontSize: 26, fontWeight: '700', paddingVertical: 2 },
  textarea: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pillText: { fontSize: 13 },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 0.3,
    borderTopColor: '#ccc',
  },
  btnPrimary: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: 'center',
    marginBottom: 8,
  },
});
