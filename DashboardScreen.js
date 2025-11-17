// DashboardScreen.js (con badge flotante y menos espacio arriba del gráfico)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import Ion from 'react-native-vector-icons/Ionicons';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import * as Lucide from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';

const MAX_VISIBLE = 3;

/* =========================
   Helpers de íconos Lucide
   ========================= */
const toPascal = (str) =>
  (str || '')
    .replace(/[-_ ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');

const getLucide = (name) => {
  if (!name) return null;
  const direct = Lucide[name];
  if (direct) return direct;
  const pascal = toPascal(name);
  return Lucide[pascal] || null;
};

const resolveIconByNombre = (nombre) => {
  const n = (nombre || '').toLowerCase();

  if (/(super|mercado|market|abarrote|mini\s?market)/.test(n)) return Lucide.ShoppingCart;
  if (/(comida|rest|almuerzo|cena|food|aliment|caf(é|e)|restaurant|bar)/.test(n)) return Lucide.Utensils;
  if (/(transp|bus|metro|taxi|uber|cabify|peaje)/.test(n)) return Lucide.Car;
  if (/(bencin|nafta|combust|gasolin)/.test(n)) return Lucide.Fuel;
  if (/(casa|hogar|arriendo|renta|depart|dept|domicilio|mudanza)/.test(n)) return Lucide.Home;
  if (/(luz|electric|energ(í|i)a|consumo)/.test(n)) return Lucide.Lightbulb;
  if (/(agua|sanitari|potable)/.test(n)) return Lucide.Droplets;
  if (/(gas|cilindro|balón|balon)/.test(n)) return Lucide.Flame;
  if (/(salud|doctor|m(e|é)d(ic|)a|farmacia|isapre|fonasa)/.test(n)) return Lucide.HeartPulse;
  if (/(educ|coleg|escuela|uni|curso|capacit)/.test(n)) return Lucide.GraduationCap;
  if (/(entreten|cine|netflix|spotify|m(ú|u)sica|musica|tv)/.test(n)) return Lucide.Clapperboard;
  if (/(ropa|vest|zapato|polera|pantal)/.test(n)) return Lucide.Shirt;
  if (/(viaje|travel|hotel|vuelo|a(é|e)reo|avion|avión)/.test(n)) return Lucide.Plane;
  if (/(tel(é|e)fono|celu|m(ó|o)vil|internet|wifi|datos)/.test(n)) return Lucide.Smartphone;
  if (/(impuesto|tax|sii|contrib|renta)/.test(n)) return Lucide.Receipt;
  if (/(mascota|perro|gato|vet)/.test(n)) return Lucide.Dog;
  if (/(deporte|gym|gimnas)/.test(n)) return Lucide.Dumbbell;
  if (/(banco|tarjeta|cr(é|e)dito|cuota|financ)/.test(n)) return Lucide.CreditCard;

  return Lucide.Tag;
};

const resolveIcon = (iconName, nombre) => {
  const fromDB = getLucide(iconName);
  if (fromDB) return fromDB;
  return resolveIconByNombre(nombre) || Lucide.Tag;
};

/* =========================
   Helpers de fecha LOCAL
   ========================= */
const ymdLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayYMD = () => ymdLocal(new Date());

const normalizeToYMD = (val) => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  return ymdLocal(new Date(val));
};

export default function DashboardScreen({ route, navigation }) {
  const { theme } = useTheme();
  const params = route?.params ?? {};
  const [perfil, setPerfil] = useState({ nombre: params?.nombre, email: params?.email });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showAllRecent, setShowAllRecent] = useState(false);

  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [prevMonthlyTotal, setPrevMonthlyTotal] = useState(0);
  const [montosRecientes, setMontosRecientes] = useState([]);
  const [recurrentes, setRecurrentes] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [dailyTotal, setDailyTotal] = useState(0);

  const [tiposGastoUI, setTiposGastoUI] = useState([]);
  const [tiposDict, setTiposDict] = useState({});

  const [nearLimitTypes, setNearLimitTypes] = useState([]);
  const [overLimitTypes, setOverLimitTypes] = useState([]);
  const [limitsEnabled, setLimitsEnabled] = useState(false);
  const [notifyPercent, setNotifyPercent] = useState(80);
  const [limitsMap, setLimitsMap] = useState({});

  // gráfico semanal
  const [weeklyData, setWeeklyData] = useState([]);
  const [selectedBarIndex, setSelectedBarIndex] = useState(-1);

  const screenWidth = Dimensions.get('window').width;
  const containerHPad = 20;
  const cardHPad = 16;
  const chartWidth = Math.max(0, screenWidth - 2 * containerHPad - 2 * cardHPad);

  const nBars = weeklyData?.length ?? 0;
  const bw = 28;
  const sp = nBars > 1 ? Math.max(6, (chartWidth - nBars * bw) / (nBars - 1)) : 0;

  const getIniciales = (nombre = '') => {
    const partes = (nombre || '').trim().split(' ').filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return partes[0].charAt(0).toUpperCase();
  };
  const getPrimerNombre = (nombre = '') => {
    const partes = (nombre || '').trim().split(' ').filter(Boolean);
    return partes.length > 0 ? partes[0] : 'Usuario';
  };
  const nombre = perfil?.nombre || 'Usuario';
  const primerNombre = getPrimerNombre(nombre);

  const formatCLP = (n) => {
    const num = Number(n || 0);
    const s = Math.round(num).toString();
    return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  const formatUIDate = (val) => {
    const ymd = normalizeToYMD(val);
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${d}/${m}/${y}`;
  };

  const monthRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { startYMD: ymdLocal(start), endYMD: ymdLocal(end) };
  }, []);

  const prevMonthRange = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const prevStart = new Date(y, m - 1, 1);
    const prevEnd = new Date(y, m, 0);
    return { startYMD: ymdLocal(prevStart), endYMD: ymdLocal(prevEnd) };
  }, []);

  const monthNameEs = useMemo(() => {
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const idx = new Date().getMonth();
    const name = meses[idx] || '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, []);

  const { deltaPctAbs, isUp } = useMemo(() => {
    const curr = Number(monthlyTotal || 0);
    const prev = Number(prevMonthlyTotal || 0);
    if (prev <= 0 && curr <= 0) return { deltaPctAbs: 0, isUp: false };
    if (prev <= 0 && curr > 0) return { deltaPctAbs: 100, isUp: true };
    const delta = ((curr - prev) / prev) * 100;
    return { deltaPctAbs: Math.abs(delta), isUp: delta > 0 };
  }, [monthlyTotal, prevMonthlyTotal]);

  const deltaAmount = useMemo(
    () => Number(monthlyTotal || 0) - Number(prevMonthlyTotal || 0),
    [monthlyTotal, prevMonthlyTotal]
  );

  // Perfil
  useEffect(() => {
    const fetchPerfil = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return;

        const { data, error } = await supabase
          .from('usuarios')
          .select('nombre, email, limits_by_category_enabled, notify_at_percent')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setPerfil({ nombre: data.nombre, email: data.email });
          setLimitsEnabled(Boolean(data.limits_by_category_enabled));
          setNotifyPercent(data.notify_at_percent || 80);
        }
      } catch (e) {
        console.log('Error al cargar perfil:', e?.message);
      } finally {
        setLoading(false);
      }
    };

    if (!params?.nombre || !params?.email) {
      fetchPerfil();
    }
  }, [params?.nombre, params?.email]);

  const dailyAvgThisMonth = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    if (day <= 0) return 0;
    return Number(monthlyTotal || 0) / day;
  }, [monthlyTotal]);

  const fetchMonthlyTotalAndRecent = useCallback(
    async () => {
      try {
        if (!refreshing) setLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) {
          setMonthlyTotal(0);
          setPrevMonthlyTotal(0);
          setMontosRecientes([]);
          setRecurrentes([]);
          setPendingCount(0);
          setTiposGastoUI([]);
          setTiposDict({});
          setDailyTotal(0);
          return;
        }

        let localLimitsEnabled = limitsEnabled;
        let localNotifyPercent = notifyPercent;

        const { data: userCfg, error: errUserCfg } = await supabase
          .from('usuarios')
          .select('nombre, email, limits_by_category_enabled, notify_at_percent')
          .eq('id', user.id)
          .single();

        if (!errUserCfg && userCfg) {
          setPerfil({ nombre: userCfg.nombre, email: userCfg.email });
          localLimitsEnabled = Boolean(userCfg.limits_by_category_enabled);
          localNotifyPercent = userCfg.notify_at_percent || 80;
          setLimitsEnabled(localLimitsEnabled);
          setNotifyPercent(localNotifyPercent);
        }

        const { data: tiposData, error: errTipos } = await supabase
          .from('tipos_gastos')
          .select('id, nombre, icon_name')
          .eq('user_id', user.id);

        const tiposDictTmp = {};
        if (!errTipos && Array.isArray(tiposData)) {
          tiposData.forEach((t) => {
            const IconCmp = resolveIcon(t.icon_name, t.nombre);
            const id = String(t.id);
            tiposDictTmp[id] = {
              nombre: t.nombre || 'Tipo',
              icon_name: t.icon_name || null,
              IconCmp,
            };
          });
        }
        setTiposDict(tiposDictTmp);

        const { data: limitsData, error: errLimits } = await supabase
          .from('user_category_limits')
          .select('category_id, monthly_limit')
          .eq('user_id', user.id);

        const limitsTmpMap = {};
        if (!errLimits && Array.isArray(limitsData)) {
          limitsData.forEach((row) => {
            const idStr = String(row.category_id);
            limitsTmpMap[idStr] = Number(row.monthly_limit || 0);
          });
        }
        setLimitsMap(limitsTmpMap);

        const { data, error } = await supabase
          .from('gastos')
          .select('id, fecha, tipo, id_tipo_gasto, total, nota')
          .eq('user_id', user.id)
          .gte('fecha', monthRange.startYMD)
          .lte('fecha', monthRange.endYMD)
          .order('fecha', { ascending: false })
          .limit(200);

        if (error) {
          console.log('Error leyendo gastos actuales:', error.message);
          setMonthlyTotal(0);
          setMontosRecientes([]);
          setDailyTotal(0);
        } else {
          const sum = (data || []).reduce(
            (acc, it) => acc + Number(it.total || 0),
            0
          );
          setMonthlyTotal(sum);

          const today = todayYMD();
          const todayTotal = (data || [])
            .filter((g) => normalizeToYMD(g.fecha) === today)
            .reduce((acc, it) => acc + Number(it.total || 0), 0);
          setDailyTotal(todayTotal);

          const recientes = (data || []).map((g) => {
            let nombreTipo = 'Gasto';
            let IconCmp = Lucide.Tag;

            const idStr =
              g.id_tipo_gasto != null ? String(g.id_tipo_gasto) : null;
            if (idStr && tiposDictTmp[idStr]) {
              nombreTipo = tiposDictTmp[idStr].nombre;
              IconCmp = tiposDictTmp[idStr].IconCmp || Lucide.Tag;
            } else if (g.tipo) {
              nombreTipo = g.tipo;
              IconCmp = resolveIcon(null, nombreTipo) || Lucide.Tag;
            }

            return {
              id: String(g.id),
              producto: nombreTipo,
              sub: `${formatUIDate(g.fecha)}${
                g.nota ? ' • ' + String(g.nota).trim() : ''
              }`,
              monto: Number(g.total || 0),
              IconCmp,
            };
          });
          setMontosRecientes(recientes);

          const totalsByTipoId = {};
          (data || []).forEach((g) => {
            const idStr =
              g.id_tipo_gasto != null ? String(g.id_tipo_gasto) : null;
            if (!idStr) return;
            totalsByTipoId[idStr] =
              (totalsByTipoId[idStr] || 0) + Number(g.total || 0);
          });

          const tiposUIWithTotals = Object.entries(tiposDictTmp).map(
            ([id, info]) => ({
              id,
              nombre: info.nombre,
              IconCmp: info.IconCmp,
              totalMes: totalsByTipoId[id] || 0,
            })
          );

          tiposUIWithTotals.sort((a, b) => {
            if (b.totalMes !== a.totalMes) return b.totalMes - a.totalMes;
            return a.nombre.localeCompare(b.nombre);
          });

          if (!limitsEnabled) {
            setNearLimitTypes([]);
            setOverLimitTypes([]);
          } else {
            const near = [];
            const over = [];
            const factor = (localNotifyPercent || 80) / 100;

            tiposUIWithTotals.forEach((t) => {
              const idStr = String(t.id);
              const limit = Number(limitsTmpMap[idStr] || 0);
              if (!limit) return;

              const spent = Number(t.totalMes || 0);

              if (spent >= limit) {
                over.push({ ...t, spent, limit });
              } else if (spent >= limit * factor) {
                near.push({ ...t, spent, limit });
              }
            });

            setNearLimitTypes(near);
            setOverLimitTypes(over);
          }

          setTiposGastoUI(tiposUIWithTotals);
        }

        const { data: dataPrev, error: errPrev } = await supabase
          .from('gastos')
          .select('total, fecha')
          .eq('user_id', user.id)
          .gte('fecha', prevMonthRange.startYMD)
          .lte('fecha', prevMonthRange.endYMD);

        if (errPrev) {
          console.log('Error leyendo gastos previos:', errPrev.message);
          setPrevMonthlyTotal(0);
        } else {
          const sumPrev = (dataPrev || []).reduce(
            (acc, it) => acc + Number(it.total || 0),
            0
          );
          setPrevMonthlyTotal(sumPrev);
        }

        const { data: dataRec, error: errRec } = await supabase
          .from('gastos_recurrentes')
          .select('id, nombre, monto, activo')
          .eq('user_id', user.id)
          .order('nombre', { ascending: true })
          .limit(200);

        if (errRec) {
          console.log('Error leyendo recurrentes:', errRec.message);
          setRecurrentes([]);
        } else {
          setRecurrentes(
            (dataRec || []).map((r) => ({
              id: String(r.id),
              nombre: r.nombre || 'Recurrente',
              monto: Number(r.monto || 0),
              activo: Boolean(r.activo),
            }))
          );
        }

        const { count: pendCount, error: errPend } = await supabase
          .from('gastos_recurrentes_ocurrencias')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('fecha_venc', monthRange.startYMD)
          .lte('fecha_venc', monthRange.endYMD)
          .eq('estado', 'pendiente');

        if (errPend) {
          console.log('Error contando pendientes:', errPend.message);
          setPendingCount(0);
        } else {
          setPendingCount(pendCount || 0);
        }
      } catch (e) {
        console.log('Excepción leyendo datos del dashboard:', e?.message);
        setMonthlyTotal(0);
        setPrevMonthlyTotal(0);
        setMontosRecientes([]);
        setRecurrentes([]);
        setPendingCount(0);
        setTiposGastoUI([]);
        setTiposDict({});
        setDailyTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [monthRange, prevMonthRange, refreshing, limitsEnabled, notifyPercent]
  );

  // gráfico semanal
  const fetchWeeklyData = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setWeeklyData([]);
        return;
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6);

      const { data, error } = await supabase
        .from('gastos')
        .select('fecha, total')
        .eq('user_id', user.id)
        .gte('fecha', ymdLocal(startDate))
        .lte('fecha', ymdLocal(endDate));

      if (error) throw error;

      const totalsByDay = {};
      (data || []).forEach((g) => {
        const key = normalizeToYMD(g.fecha);
        totalsByDay[key] = (totalsByDay[key] || 0) + Number(g.total || 0);
      });

      const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const result = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const key = ymdLocal(d);

        const dow = d.getDay();
        const idxDia = dow === 0 ? 6 : dow - 1;
        const label = diasSemana[idxDia];

        result.push({
          idx: i,
          label,
          value: totalsByDay[key] || 0,
        });
      }

      setWeeklyData(result);
      setSelectedBarIndex(-1);
    } catch (e) {
      console.log('Error cargando datos semanales:', e.message);
      setWeeklyData([]);
      setSelectedBarIndex(-1);
    }
  }, []);

  useEffect(() => {
    fetchMonthlyTotalAndRecent();
    fetchWeeklyData();
  }, [fetchMonthlyTotalAndRecent, fetchWeeklyData]);

  useFocusEffect(
    useCallback(() => {
      fetchMonthlyTotalAndRecent();
      fetchWeeklyData();
    }, [fetchMonthlyTotalAndRecent, fetchWeeklyData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMonthlyTotalAndRecent();
    fetchWeeklyData();
  }, [fetchMonthlyTotalAndRecent, fetchWeeklyData]);

  const onVerDetalle = (item) => {
    Alert.alert(
      'Detalle',
      `${item.producto}\n${item.sub}\nMonto: ${formatCLP(item.monto)}`
    );
  };

  const recentToShow = useMemo(
    () =>
      showAllRecent
        ? montosRecientes
        : montosRecientes.slice(0, MAX_VISIBLE),
    [showAllRecent, montosRecientes]
  );

  const activosRecurrentes = recurrentes.filter((r) => r.activo).length;

  const renderMontoItem = ({ item }) => {
    const IconCmp = item.IconCmp || Lucide.Tag;
    return (
      <View
        style={[
          styles.listItem,
          { backgroundColor: theme.colors.card },
        ]}
      >
        <View
          style={[
            styles.itemAvatar,
            {
              backgroundColor: theme.isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.05)',
              borderColor: theme.isDark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(0,0,0,0.08)',
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <IconCmp
            size={18}
            color={theme.colors.text}
            strokeWidth={2.2}
          />
        </View>

        <View style={styles.itemTextWrap}>
          <Text
            style={[styles.itemTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {item.producto}
          </Text>
          <Text
            style={[styles.itemSub, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {item.sub}
          </Text>
        </View>

        <View style={styles.itemRight}>
          <Text
            style={[
              styles.itemAmount,
              { color: theme.colors.text },
            ]}
          >
            {formatCLP(item.monto)}
          </Text>
          <TouchableOpacity
            onPress={() => onVerDetalle(item)}
            style={styles.detailBtn}
          />
        </View>
      </View>
    );
  };

  const renderTipoCard = ({ item }) => {
    const IconCmp = item.IconCmp || Lucide.Tag;
    const goToFiltered = () => {
      navigation.navigate('ExpensesList', {
        filterTipoGastoId: item.id,
        filterTipoGastoNombre: item.nombre,
      });
    };

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={goToFiltered}
        style={styles.tipoCardWrap}
      >
        <View
          style={[
            styles.tipoIconBtn,
            {
              backgroundColor: theme.isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
              borderColor: theme.isDark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <IconCmp
            size={26}
            color={theme.colors.text}
            strokeWidth={2.2}
          />
        </View>
        <Text
          style={[styles.tipoLabel, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {item.nombre}
        </Text>
      </TouchableOpacity>
    );
  };

  const dynamicMaxValue = useMemo(() => {
    if (!weeklyData || weeklyData.length === 0) return 1000;
    const maxY = Math.max(...weeklyData.map((d) => d.value || 0));
    if (maxY <= 0) return 1000;
    return Math.ceil((maxY * 1.25) / 1000) * 1000;
  }, [weeklyData]);

  const chartData = useMemo(
    () =>
      weeklyData.map((it, index) => ({
        ...it,
        frontColor:
          selectedBarIndex === index
            ? theme.isDark
              ? '#ffffff'
              : '#000000'
            : theme.isDark
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(0,0,0,0.18)',
      })),
    [weeklyData, selectedBarIndex, theme]
  );

  const selectedBar =
    selectedBarIndex >= 0 && weeklyData[selectedBarIndex]
      ? weeklyData[selectedBarIndex]
      : null;

  useEffect(() => {
    if (selectedBarIndex < 0) return;
    const t = setTimeout(() => setSelectedBarIndex(-1), 2200);
    return () => clearTimeout(t);
  }, [selectedBarIndex]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {loading && !refreshing ? (
        <ActivityIndicator color={theme.colors.text} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.text}
            />
          }
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text
                style={[styles.hello, { color: theme.colors.text }]}
              >
                Hola,
              </Text>
              <Text
                style={[styles.userName, { color: theme.colors.text }]}
              >
                {primerNombre}
              </Text>
            </View>
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
                {getIniciales(nombre)}
              </Text>
            </View>
          </View>

          {/* Cards pequeñas */}
          <View style={styles.row}>
            {/* Promedio diario */}
            <View
              style={[
                styles.smallCard,
                { backgroundColor: theme.colors.card },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
              >
                <Ion
                  name="bar-chart-outline"
                  size={20}
                  color={theme.isDark ? '#000' : '#fff'}
                />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    color: theme.colors.text,
                  }}
                >
                  Promedio diario
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    marginTop: 2,
                    color: theme.colors.text,
                  }}
                >
                  {formatCLP(dailyAvgThisMonth)}
                </Text>
              </View>
            </View>

            {/* Gastado HOY */}
            <View
              style={[
                styles.smallCard,
                { backgroundColor: theme.colors.card },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
              >
                <Ion
                  name="cash-outline"
                  size={20}
                  color={theme.isDark ? '#000' : '#fff'}
                />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text
                  style={{
                    fontSize: 10,
                    opacity: 0.6,
                    color: theme.colors.text,
                  }}
                >
                  Gastos del día
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    marginTop: 2,
                    color: theme.colors.text,
                  }}
                >
                  {formatCLP(Math.abs(dailyTotal))}
                </Text>
              </View>
            </View>
          </View>

          {/* Por confirmar */}
          {pendingCount > 0 && (
            <View
              style={[
                styles.smallCard,
                {
                  backgroundColor: theme.colors.card,
                  marginTop: 12,
                },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
              >
                <Ion
                  name="time-outline"
                  size={20}
                  color={theme.isDark ? '#000' : '#fff'}
                />
              </View>

              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    color: theme.colors.text,
                  }}
                >
                  Gastos por confirmar
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '800',
                    color: theme.colors.text,
                    marginTop: 2,
                  }}
                >
                  {pendingCount}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('RecurringConfirm')}
                style={[
                  styles.chipBtnFilled,
                  { backgroundColor: theme.isDark ? '#fff' : '#000' },
                ]}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.chipTxtFilled,
                    { color: theme.isDark ? '#000' : '#fff' },
                  ]}
                >
                  Revisar
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Gasto del mes */}
          <View
            style={[
              styles.bigCard,
              { backgroundColor: theme.colors.card },
            ]}
          >
            <View
              style={[
                styles.iconCircleBig,
                { backgroundColor: theme.isDark ? '#fff' : '#000' },
              ]}
            >
              <Ion
                name="wallet-outline"
                size={26}
                color={theme.isDark ? '#000' : '#fff'}
              />
            </View>
            <View style={{ marginLeft: 14 }}>
              <Text
                style={[
                  styles.bigCardTitle,
                  { color: theme.colors.text },
                ]}
              >
                {monthNameEs}
              </Text>
              <Text
                style={[
                  styles.bigCardNumber,
                  { color: theme.colors.text },
                ]}
              >
                {formatCLP(monthlyTotal)}
              </Text>
              <Text
                style={[
                  styles.bigCardHint,
                  { color: theme.colors.text },
                ]}
              >
                Gasto del mes
              </Text>
            </View>
          </View>

          {/* Carrusel Tipos */}
          {tiposGastoUI.length > 0 && (
            <View style={{ marginTop: 20, marginBottom: 8 }}>
              <FlatList
                horizontal
                data={tiposGastoUI}
                keyExtractor={(it) => it.id}
                renderItem={renderTipoCard}
                showsHorizontalScrollIndicator={false}
                style={{ minHeight: 88 }}
                contentContainerStyle={{
                  paddingVertical: 6,
                  paddingHorizontal: 6,
                }}
                ItemSeparatorComponent={() => (
                  <View style={{ width: 8 }} />
                )}
              />
            </View>
          )}

          {/* Recientes */}
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              Gastos recientes
            </Text>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              onPress={() => navigation.navigate('ExpensesList')}
              style={[
                styles.sectionBtn,
                { borderColor: theme.isDark ? '#fff' : '#000' },
              ]}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.sectionBtnTxt,
                  { color: theme.colors.text },
                ]}
              >
                Ver todos
              </Text>
              <Ion
                name="chevron-forward"
                size={14}
                color={theme.colors.text}
                style={{ marginLeft: 6, opacity: 0.8 }}
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={recentToShow}
            keyExtractor={(item) => item.id}
            renderItem={renderMontoItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            ListEmptyComponent={
              <Text
                style={{
                  color: theme.colors.text,
                  opacity: 0.7,
                }}
              >
                No hay gastos este mes.
              </Text>
            }
          />

          {/* Alertas de límites */}
          {limitsEnabled &&
            (nearLimitTypes.length > 0 ||
              overLimitTypes.length > 0) && (
              <View
                style={{ marginTop: 28, marginBottom: 8 }}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  Alerta de presupuesto
                </Text>

                <View
                  style={[
                    styles.bigCard,
                    {
                      backgroundColor: theme.colors.card,
                      marginTop: 10,
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      paddingVertical: 16,
                      paddingHorizontal: 10,
                      justifyContent: 'flex-start',
                    },
                  ]}
                >
                  {overLimitTypes.map((t) => {
                    const IconComponent =
                      t.IconCmp || Lucide.Tag;
                    return (
                      <View
                        key={t.id}
                        style={{
                          width: 70,
                          alignItems: 'center',
                          marginRight: 12,
                          marginBottom: 18,
                        }}
                      >
                        <View
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: theme.isDark
                              ? '#FF3B30'
                              : '#ffcccc',
                          }}
                        >
                          <IconComponent
                            size={22}
                            color={
                              theme.isDark ? '#fff' : '#000'
                            }
                          />
                        </View>

                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            fontWeight: '500',
                            color: theme.colors.text,
                            textAlign: 'center',
                            width: '100%',
                          }}
                        >
                          {t.nombre}
                        </Text>
                      </View>
                    );
                  })}

                  {nearLimitTypes.map((t) => {
                    const IconComponent =
                      t.IconCmp || Lucide.Tag;
                    return (
                      <View
                        key={t.id}
                        style={{
                          width: 70,
                          alignItems: 'center',
                          marginRight: 12,
                          marginBottom: 18,
                        }}
                      >
                        <View
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: theme.isDark
                              ? '#FFCC00'
                              : '#fff3cd',
                          }}
                        >
                          <IconComponent
                            size={22}
                            color={
                              theme.isDark ? '#fff' : '#000'
                            }
                          />
                        </View>

                        <Text
                          numberOfLines={1}
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            fontWeight: '500',
                            color: theme.colors.text,
                            textAlign: 'center',
                            width: '100%',
                          }}
                        >
                          {t.nombre}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

          {/* Resumen Recurrentes */}
          <View
            style={[
              styles.bigCard,
              { backgroundColor: theme.colors.card, marginTop: 20 },
            ]}
          >
            <View
              style={[
                styles.iconCircleBig,
                { backgroundColor: theme.isDark ? '#fff' : '#000' },
              ]}
            >
              <Ion
                name="repeat-outline"
                size={26}
                color={theme.isDark ? '#000' : '#fff'}
              />
            </View>

            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text
                style={[
                  styles.bigCardTitle,
                  { color: theme.colors.text },
                ]}
              >
                Gastos recurrentes
              </Text>
              <Text
                style={[
                  styles.bigCardNumber,
                  { color: theme.colors.text },
                ]}
              >
                {activosRecurrentes}
              </Text>
              <Text
                style={[
                  styles.bigCardHint,
                  { color: theme.colors.text },
                ]}
              >
                activos
              </Text>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('RecurringList')
                }
                style={[
                  styles.chipBtn,
                  { borderColor: theme.isDark ? '#fff' : '#000' },
                ]}
              >
                <Text
                  style={[
                    styles.chipTxt,
                    { color: theme.colors.text },
                  ]}
                >
                  Ver todos
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== Gasto semanal ===== */}
          <View style={styles.sectionHeaderRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.text },
              ]}
            >
              Gasto semanal
            </Text>

            <Text
              style={[
                styles.sparkHint,
                { color: theme.colors.text, opacity: 0.6 },
              ]}
            >
              Últimos 7 días
            </Text>
          </View>

          <View
            style={[
              styles.sparkCard,
              {
                backgroundColor: theme.colors.card,
              },
            ]}
          >
            {/* Badge flotante */}
            {selectedBar && (
              <View
                style={[
                  styles.badgeSelectedDay,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.16)'
                      : 'rgba(0,0,0,0.06)',
                    position: 'absolute',
                    left: 16,
                    top: 8,
                    zIndex: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeDayText,
                    { color: theme.colors.text },
                  ]}
                >
                  {selectedBar.label}
                </Text>
                <Text
                  style={[
                    styles.badgeAmountText,
                    { color: theme.colors.text },
                  ]}
                >
                  {formatCLP(selectedBar.value || 0)}
                </Text>
              </View>
            )}

            <BarChart
              data={chartData}
              width={chartWidth}
              maxValue={dynamicMaxValue}
              noOfSections={4}
              height={190}
              barWidth={bw}
              spacing={sp}
              initialSpacing={0}
              roundedTop
              roundedBottom
              barBorderRadius={4}
              hideRules
              hideYAxisText
              xAxisThickness={0}
              yAxisThickness={0}
              xAxisLabelTextStyle={{
                color: theme.colors.text,
                opacity: 0.8,
                fontSize: 11,
                marginTop: 6,
              }}
              onPress={(item, index) => {
                setSelectedBarIndex((prev) =>
                  prev === index ? -1 : index
                );
              }}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 50 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 40,
  },
  hello: { fontSize: 20, opacity: 0.8 },
  userName: { fontSize: 26, fontWeight: 'bold' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: 'bold' },

  sectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 1,
    borderRadius: 999,
  },
  sectionBtnTxt: { fontSize: 12, fontWeight: '700' },

  tipoCardWrap: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  tipoIconBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipoLabel: {
    marginTop: 6,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },

  row: { flexDirection: 'row', justifyContent: 'space-between' },
  smallCard: {
    flex: 0.48,
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bigCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 3,
  },
  iconCircleBig: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigCardTitle: { fontSize: 16, opacity: 0.8 },
  bigCardNumber: { fontSize: 30, fontWeight: 'bold', marginTop: 4 },
  bigCardHint: { fontSize: 12, opacity: 0.6, marginTop: 2 },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 4,          // 👈 más pequeño
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  itemAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTextWrap: { flex: 1, marginLeft: 10 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemSub: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemAmount: { fontSize: 16, fontWeight: '700' },
  detailBtn: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 6 },

  sparkCard: {
    marginTop: 6,               // 👈 card más pegado al título
    paddingTop: 28,             // espacio fijo arriba para que el badge no empuje nada
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderRadius: 16,
    overflow: 'visible',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  sparkTitle: { fontSize: 16, fontWeight: '800' },
  sparkHint: { fontSize: 12, fontWeight: '600' },

  badgeSelectedDay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeDayText: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  badgeAmountText: {
    fontSize: 13,
    fontWeight: '800',
  },

  chipBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  chipBtnFilled: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chipTxtFilled: { fontSize: 12, fontWeight: '800' },
});
