// LimitsByCategoryScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';

Ionicons.loadFont();

// Formatea un número a CLP simple: 150000 -> $150.000
const formatCLP = (value) => {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return '';
  const s = Math.round(num).toString();
  return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Deja solo dígitos
const onlyDigits = (str) => (str || '').replace(/\D/g, '');

export default function LimitsByCategoryScreen({ navigation }) {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);

  // arreglo [{ id, nombre, icono, limitValue }]
  const [items, setItems] = useState([]);

  // =========================
  // Cargar categorías + topes
  // =========================
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 1) obtener usuario
      const { data: sessionData, error: sessErr } =
        await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      const user = sessionData?.session?.user;
      if (!user) {
        Alert.alert('Sesión', 'No hay sesión activa.');
        navigation.goBack();
        return;
      }
      setUserId(user.id);

      // 2) tipos de gasto del usuario (tabla simple: id, nombre, user_id)
      const { data: tipos, error: tiposErr } = await supabase
        .from('tipos_gastos')
        .select('id, nombre')
        .eq('user_id', user.id);

      if (tiposErr) throw tiposErr;

      // 3) topes ya definidos
      const { data: limits, error: limitsErr } = await supabase
        .from('user_category_limits')
        .select('category_id, monthly_limit')
        .eq('user_id', user.id);

      if (limitsErr) throw limitsErr;

      const limitsMap = {};
      (limits || []).forEach((r) => {
        limitsMap[r.category_id] = r.monthly_limit;
      });

      // 4) fusionar: categorías + tope
      const merged = (tipos || []).map((t) => ({
        id: t.id,
        nombre: t.nombre,
        icono: 'pricetag-outline', // icono por defecto
        limitValue: limitsMap[t.id] != null ? String(limitsMap[t.id]) : '',
      }));

      setItems(merged);
    } catch (err) {
      console.log('loadData error:', err);
      Alert.alert('Error', 'No se pudieron cargar los topes.');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =========================
  // Manejar cambio de tope
  // =========================
  const onChangeLimit = (id, raw) => {
    const clean = onlyDigits(raw);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, limitValue: clean }
          : it
      )
    );
  };

  // =========================
  // Guardar cambios
  // =========================
  const onSave = async () => {
    if (!userId) return;

    try {
      setSaving(true);

      const upserts = [];
      const deletes = [];

      items.forEach((it) => {
        const val = it.limitValue;
        if (!val) {
          // sin valor => eliminar tope
          deletes.push(it.id);
        } else {
          const num = Number(val);
          if (!isNaN(num) && num >= 0) {
            upserts.push({
              user_id: userId,
              category_id: it.id,
              monthly_limit: num,
            });
          }
        }
      });

      // 1) upsert
      if (upserts.length > 0) {
        const { error: upErr } = await supabase
          .from('user_category_limits')
          .upsert(upserts, {
            onConflict: 'user_id,category_id',
          });
        if (upErr) throw upErr;
      }

      // 2) delete
      if (deletes.length > 0) {
        const { error: delErr } = await supabase
          .from('user_category_limits')
          .delete()
          .eq('user_id', userId)
          .in('category_id', deletes);
        if (delErr) throw delErr;
      }

      Alert.alert('Topes guardados', 'Se actualizaron los límites por categoría.');
      loadData();
    } catch (err) {
      console.log('onSave error:', err);
      Alert.alert('Error', 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // Render item lista
  // =========================
  const renderItem = ({ item }) => {
    const formatted = formatCLP(item.limitValue);

    return (
      <View
        style={[
          styles.row,
          { backgroundColor: theme.colors.card },
        ]}
      >
        <View style={styles.rowLeft}>
          <View
            style={[
              styles.rowIcon,
              { backgroundColor: theme.isDark ? '#ffffff14' : '#00000010' },
            ]}
          >
            <Ionicons
              name={item.icono || 'pricetag-outline'}
              size={18}
              color={theme.isDark ? '#fff' : '#000'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.rowTitle,
                { color: theme.colors.text },
              ]}
            >
              {item.nombre}
            </Text>
            {formatted ? (
              <Text style={[styles.rowSubtitle, { color: theme.colors.text }]}>
                {formatted} / mes
              </Text>
            ) : (
              <Text style={[styles.rowSubtitle, { color: theme.colors.text }]}>
                Sin tope definido
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rowRight}>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.isDark ? '#ffffff33' : '#00000022',
                color: theme.colors.text,
              },
            ]}
            keyboardType="numeric"
            placeholder="Ej: 150000"
            placeholderTextColor={theme.isDark ? '#888' : '#999'}
            value={item.limitValue}
            onChangeText={(txt) => onChangeLimit(item.id, txt)}
          />
        </View>
      </View>
    );
  };

  // =========================
  // Render principal
  // =========================
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centerBox}>
          <ActivityIndicator color={theme.colors.text} />
          <Text style={{ marginTop: 8, color: theme.colors.text }}>
            Cargando topes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Topes por categoría
          </Text>
          <Text style={[styles.description, { color: theme.colors.text }]}>
            Define un monto máximo mensual por cada tipo de gasto. Si dejas un
            campo vacío, esa categoría no tendrá tope.
          </Text>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />

        {/* Footer con dos botones: Guardar y Volver */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: saving
                  ? (theme.isDark ? '#555' : '#ccc')
                  : (theme.isDark ? '#ffffff' : '#000000'),
              },
            ]}
            activeOpacity={0.85}
            onPress={onSave}
            disabled={saving}
          >
            <Text
              style={[
                styles.saveButtonText,
                {
                  color: theme.isDark ? '#000000' : '#ffffff',
                  opacity: saving ? 0.8 : 1,
                },
              ]}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cancelButton,
              {
                borderColor: theme.isDark ? '#ffffff55' : '#00000055',
              },
            ]}
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
          >
            <Text
              style={[
                styles.cancelButtonText,
                { color: theme.colors.text },
              ]}
            >
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    opacity: 0.7,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  row: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  rowRight: {
    marginLeft: 10,
  },
  input: {
    width: 100,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    fontSize: 14,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
