import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';

const formatDDMMYYYY = (date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};
const formatYYYYMMDD = (date) => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState('');
  const [date, setDate] = useState(new Date(2000, 0, 1));
  const [showPicker, setShowPicker] = useState(false);

  const [genero, setGenero] = useState(null);
  const [trabajoSel, setTrabajoSel] = useState(null);
  const [trabajoOtro, setTrabajoOtro] = useState('');
  const trabajoInputRef = useRef(null);

  const opcionesTrabajo = [
    { key: 'Agrónomo', label: 'Agrónomo' },
    { key: 'Ventas', label: 'Ventas' },
    { key: 'Estudiante', label: 'Estudiante' },
    { key: 'Otro', label: 'Otro' },
  ];

  const cargar = async () => {
    try {
      setLoading(true);
      const { data: userData, error: gErr } = await supabase.auth.getUser();
      if (gErr) throw gErr;
      const user = userData?.user;
      if (!user) {
        navigation.replace('LoginScreen');
        return;
      }

      const { data, error } = await supabase
        .from('usuarios')
        .select('nombre, fecha_nacimiento, genero, trabajo')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.nombre) setNombre(data.nombre);

      if (data?.fecha_nacimiento) {
        const [y, m, d] = data.fecha_nacimiento.split('-').map(Number);
        if (y && m && d) setDate(new Date(y, m - 1, d));
      }

      if (data?.genero) setGenero(data.genero);

      if (data?.trabajo) {
        const opt = opcionesTrabajo.find((o) => o.key === data.trabajo);
        if (opt) {
          setTrabajoSel(opt.key);
        } else {
          setTrabajoSel('Otro');
          setTrabajoOtro(data.trabajo);
        }
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Error', 'No se pudo cargar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const abrirPicker = () => setShowPicker(true);
  const onChangeFecha = (evt, selected) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDate(selected);
  };

  const guardar = async () => {
    const trabajoFinal =
      trabajoSel === 'Otro' ? (trabajoOtro || '').trim() : (trabajoSel || '').trim();

    if (!nombre.trim()) return Alert.alert('Falta nombre', 'Ingresa tu nombre completo.');
    if (!genero) return Alert.alert('Selecciona género', 'Elige una opción.');
    if (!trabajoFinal) return Alert.alert('Falta trabajo', 'Selecciona tu ocupación o escribe una.');

    try {
      setSaving(true);
      const { data: userData, error: gErr } = await supabase.auth.getUser();
      if (gErr) throw gErr;
      const user = userData?.user;
      if (!user) {
        Alert.alert('Sesión', 'No hay sesión activa.');
        return;
      }

      const nacimiento = formatYYYYMMDD(date);

      const { error } = await supabase
        .from('usuarios')
        .update({
          nombre: nombre.trim(),
          fecha_nacimiento: nacimiento,
          genero,
          trabajo: trabajoFinal,
        })
        .eq('id', user.id);

      if (error) {
        console.log('usuarios UPDATE error:', error);
        return Alert.alert('Error al guardar', error.message);
      }

      await supabase.auth.updateUser({
        data: { name: nombre.trim(), genero, trabajo: trabajoFinal },
      });

      Alert.alert('OK', 'Perfil actualizado.');
      navigation.goBack();
    } catch (e) {
      console.log('Editar perfil exception:', e);
      Alert.alert('No se pudo guardar', e?.message ?? 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Editar perfil</Text>

          {/* Nombre */}
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            placeholder="Ej. Iván Donoso"
            placeholderTextColor="#777"
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
          />

          {/* Fecha de nacimiento */}
          <Text style={styles.label}>Fecha de nacimiento</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={abrirPicker}>
            <View style={[styles.input, styles.inputRow]}>
              <Text style={{ color: '#000' }}>{formatDDMMYYYY(date)}</Text>
              <Ionicons name="calendar-outline" size={18} color="#000" />
            </View>
          </TouchableOpacity>
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              onChange={onChangeFecha}
              maximumDate={new Date()}
            />
          )}

          {/* Género */}
          <Text style={[styles.label, { marginTop: 16 }]}>Género</Text>
          <View style={styles.chipsRow}>
            {[
              { key: 'F', label: 'Femenino' },
              { key: 'M', label: 'Masculino' },
              { key: 'O', label: 'Otro' },
            ].map((op) => (
              <TouchableOpacity
                key={op.key}
                style={[styles.chip, genero === op.key && styles.chipActive]}
                onPress={() => setGenero(op.key)}
              >
                <Text style={[styles.chipText, genero === op.key && styles.chipTextActive]}>
                  {op.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Trabajo */}
          <Text style={[styles.label, { marginTop: 16 }]}>¿A qué te dedicas?</Text>
          <View style={styles.chipsRow}>
            {opcionesTrabajo.map((op) => (
              <TouchableOpacity
                key={op.key}
                style={[styles.chip, trabajoSel === op.key && styles.chipActive]}
                onPress={() => {
                  setTrabajoSel(op.key);
                  if (op.key === 'Otro') setTimeout(() => trabajoInputRef.current?.focus(), 0);
                }}
              >
                <Text style={[styles.chipText, trabajoSel === op.key && styles.chipTextActive]}>
                  {op.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {trabajoSel === 'Otro' && (
            <TextInput
              ref={trabajoInputRef}
              placeholder="Especifica tu ocupación"
              placeholderTextColor="#777"
              style={[styles.input, { marginTop: 10 }]}
              value={trabajoOtro}
              onChangeText={setTrabajoOtro}
            />
          )}
        </ScrollView>

        {/* Botones fijos abajo */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
            onPress={guardar}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Guardar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.secondaryText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 36 },
  title: { fontSize: 28, fontWeight: '800', color: '#000', marginTop: 80 },
  label: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 6 , marginTop: 30},
  input: {
    backgroundColor: '#f6f6f6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#000',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#000' },
  chipText: { color: '#000', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
   
    borderColor: '#eee',
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#000',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  secondaryText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
