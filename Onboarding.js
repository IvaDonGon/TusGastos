import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function Onboarding({ route, navigation }) {
  const { userId, email } = route?.params ?? {};
  const insets = useSafeAreaInsets();

  const totalSteps = 3;
  const [step, setStep] = useState(1);

  const [nombre, setNombre] = useState('');
  const [date, setDate] = useState(new Date(2000, 0, 1));
  const [showPicker, setShowPicker] = useState(false);

  const [genero, setGenero] = useState(null); // 'F','M','O'
  const [trabajoSel, setTrabajoSel] = useState(null);
  const [trabajoOtro, setTrabajoOtro] = useState('');
  const trabajoInputRef = useRef(null);

  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [perfilDB, setPerfilDB] = useState(null); // para saber qué falta

  const opcionesTrabajo = [
    { key: 'Agrónomo', label: 'Agrónomo' },
    { key: 'Ventas', label: 'Ventas' },
    { key: 'Estudiante', label: 'Estudiante' },
    { key: 'Otro', label: 'Otro' },
  ];

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.user) {
        Alert.alert('Sesión requerida', 'Vuelve a iniciar sesión para continuar.');
        navigation.replace('LoginScreen');
      }
    };
    checkSession();
  }, [navigation]);

  useEffect(() => {
    const cargarPerfil = async () => {
      try {
        setCargandoPerfil(true);
        const { data, error } = await supabase
          .from('usuarios')
          .select('nombre, email, fecha_nacimiento, genero, trabajo')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.log('cargarPerfil error:', error.message);
        }

        if (data) {
          setPerfilDB(data);
          // Prefill:
          if (data.nombre) setNombre(data.nombre);
          if (data.fecha_nacimiento) {
            const [y, m, d] = data.fecha_nacimiento.split('-').map(Number);
            if (y && m && d) setDate(new Date(y, m - 1, d));
          }
          if (data.genero) setGenero(data.genero);
          if (data.trabajo) setTrabajoSel(data.trabajo);
        } else {
          setPerfilDB(null);
        }
      } finally {
        setCargandoPerfil(false);
      }
    };

    if (userId) cargarPerfil();
  }, [userId]);

  const next = () => setStep((s) => Math.min(s + 1, totalSteps));
  const back = () => setStep((s) => Math.max(s - 1, 1));

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
  if (!userId) return Alert.alert('Sesión', 'No se encontró userId. Vuelve a iniciar sesión.');

  try {
    const nacimiento = formatYYYYMMDD(date);

    // UPDATE sencillo: manda todos los campos que manejas
    const { error } = await supabase
      .from('usuarios')
      .update({
        nombre,
        email,
        fecha_nacimiento: nacimiento,
        genero,              // 'F' | 'M' | 'O'
        trabajo: trabajoFinal,
      })
      .eq('id', userId);     // 👈 filtra por tu fila

    if (error) {
      console.log('usuarios UPDATE error:', error);
      return Alert.alert('Error al guardar', error.message);
    }

    // (Opcional) actualizar metadata en Auth
    await supabase.auth.updateUser({
      data: { name: nombre, genero, trabajo: trabajoFinal },
    });

    navigation.replace('MainTabs', { nombre, email });
  } catch (e) {
    console.log('Onboarding guardar exception:', e);
    Alert.alert('No se pudo guardar', e?.message ?? 'Error desconocido');
  }
};


  const renderStep = () => {
    if (step === 1) {
      return (
        <>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            placeholder="Ej. Iván Donoso"
            placeholderTextColor="#777"
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
          />
        </>
      );
    }

    if (step === 2) {
      return (
        <>
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
        </>
      );
    }

    return (
      <>
        <Text style={styles.label}>Género</Text>
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
      </>
    );
  };

  const onPrimary = () => (step < totalSteps ? setStep(step + 1) : guardar());

  if (cargandoPerfil) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + 20, justifyContent: 'center' }]}>
        <Text style={{ textAlign: 'center', color: '#000' }}>Cargando tu perfil…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      <Text style={styles.title}>Cuéntanos sobre ti</Text>
      <Text style={styles.stepText}>Paso {step} de {totalSteps}</Text>

      <View style={styles.content}>{renderStep()}</View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary}>
          <Text style={styles.primaryText}>{step < totalSteps ? 'Siguiente' : 'Finalizar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          style={[styles.secondaryBtn, step === 1 && styles.secondaryBtnDisabled]}
        >
          <Text style={[styles.secondaryText, step === 1 && styles.secondaryTextDisabled]}>
            Atrás
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 36 },
  title: { fontSize: 28, fontWeight: '800', color: '#000', marginTop: 100 },
  stepText: { marginTop: 6, color: '#333', marginBottom: 18 },
  content: { flex: 1, marginTop: 20 },

  label: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 6 },
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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 12,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#000',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnDisabled: { backgroundColor: '#f4f4f4', opacity: 0.6 },
  secondaryText: { color: '#000', fontWeight: '700' },
  secondaryTextDisabled: { color: '#888' },
});
