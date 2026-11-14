import React, { useEffect, useState } from 'react';
import { Alert, Button, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';

type Perfil = { id: string; nombre: string; carnet: string; carrera: string; foto: string; rol: string };
type Equipo = { id: number; nombre: string; descripcion: string; imagen: string; disponible: boolean };
type Prestamo = { id: number; equipo_id: number; usuario_id: string; fecha_prestamo: string; fecha_devolucion: string; estado: string };

export default function App() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [registro, setRegistro] = useState(false);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [nombre, setNombre] = useState('');
  const [carnet, setCarnet] = useState('');
  const [carrera, setCarrera] = useState('');
  const [foto, setFoto] = useState('');
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [pantalla, setPantalla] = useState('equipos');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setUsuario(sesion?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (usuario) cargar();
    else { setPerfil(null); setEquipos([]); setPrestamos([]); }
  }, [usuario]);

  async function cargar() {
    const { data: sesion } = await supabase.auth.getUser();
    if (!sesion.user) return;
    const p = await supabase.from('perfiles').select('*').eq('id', sesion.user.id).single();
    const e = await supabase.from('equipos').select('*').order('id');
    const s = await supabase.from('prestamos').select('*').order('id', { ascending: false });
    if (p.error || e.error || s.error) {
      Alert.alert('Error', p.error?.message || e.error?.message || s.error?.message);
      return;
    }
    setPerfil(p.data); setEquipos(e.data || []); setPrestamos(s.data || []);
  }

  async function entrar() {
    if (!correo.trim() || !clave.trim()) return Alert.alert('Aviso', 'Escribe correo y contraseña');
    setCargando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setCargando(false);
    if (error) Alert.alert('Error', error.message);
  }

  async function crearCuenta() {
    if (!correo.trim() || !clave.trim() || !nombre.trim() || !carnet.trim() || !carrera.trim()) {
      return Alert.alert('Aviso', 'Completa todos los datos');
    }
    setCargando(true);
    const { data, error } = await supabase.auth.signUp({
      email: correo.trim(), password: clave,
      options: { data: { nombre, carnet, carrera, foto } },
    });
    setCargando(false);
    if (error) return Alert.alert('Error', error.message);
    setRegistro(false);
    Alert.alert('Registro', data.session ? 'Cuenta creada' : 'Cuenta creada. Revisa tu correo para confirmarla.');
  }

  async function guardarPerfil() {
    if (!usuario || !nombre.trim() || !carnet.trim() || !carrera.trim()) return Alert.alert('Aviso', 'Completa tu perfil');
    const { error } = await supabase.from('perfiles').update({ nombre, carnet, carrera, foto }).eq('id', usuario);
    if (error) Alert.alert('Error', error.message);
    else { Alert.alert('Listo', 'Perfil guardado'); cargar(); }
  }

  async function solicitar(id: number) {
    const { error } = await supabase.rpc('solicitar_prestamo', { p_equipo_id: id });
    Alert.alert(error ? 'Error' : 'Listo', error?.message || 'Solicitud pendiente de aprobación');
    cargar();
  }

  async function cambiar(id: number, estado: string) {
    const { error } = await supabase.rpc('cambiar_estado', { p_prestamo_id: id, p_estado: estado });
    Alert.alert(error ? 'Error' : 'Listo', error?.message || `Préstamo: ${estado}`);
    cargar();
  }

  function fotoVista(uri: string) {
    return uri && /^https:\/\//i.test(uri) ? <Image source={{ uri }} style={styles.imagen} /> : null;
  }

  function input(valor: string, cambiarValor: (v: string) => void, texto: string, seguro = false) {
    return <TextInput style={styles.input} placeholder={texto} value={valor} onChangeText={cambiarValor} secureTextEntry={seguro} autoCapitalize="none" />;
  }

  if (!usuario) return (
    <ScrollView contentContainerStyle={styles.contenedor}>
      <Text style={styles.titulo}>Laboratorio universitario</Text>
      <Text>{registro ? 'Registro de estudiante' : 'Iniciar sesión'}</Text>
      {input(correo, setCorreo, 'Correo electrónico')}
      {input(clave, setClave, 'Contraseña', true)}
      {registro && <>
        {input(nombre, setNombre, 'Nombre completo')}
        {input(carnet, setCarnet, 'Carnet universitario')}
        {input(carrera, setCarrera, 'Carrera')}
        {input(foto, setFoto, 'URL https de foto (opcional)')}
      </>}
      <Button title={cargando ? 'Espera...' : registro ? 'Registrarme' : 'Entrar'} disabled={cargando} onPress={registro ? crearCuenta : entrar} />
      <View style={styles.espacio} />
      <Button title={registro ? 'Ya tengo cuenta' : 'Crear cuenta de estudiante'} onPress={() => setRegistro(!registro)} />
    </ScrollView>
  );

  if (!perfil) return <View style={styles.contenedor}><Text>Cargando perfil...</Text><Button title="Reintentar" onPress={cargar} /><Button title="Salir" onPress={() => supabase.auth.signOut()} /></View>;

  const admin = perfil.rol === 'administrador';
  const nombreEquipo = (id: number) => equipos.find(e => e.id === id)?.nombre || 'Equipo';
  const conteo = equipos.map(e => ({ nombre: e.nombre, total: prestamos.filter(p => p.equipo_id === e.id).length }))
    .sort((a, b) => b.total - a.total);

  return (
    <ScrollView contentContainerStyle={styles.contenedor}>
      <Text style={styles.titulo}>Gestión de laboratorio</Text>
      <Text>Hola, {perfil.nombre} ({perfil.rol})</Text>
      <View style={styles.espacio} />
      <Button title="Equipos" onPress={() => setPantalla('equipos')} />
      <Button title="Mis préstamos / Historial" onPress={() => setPantalla('prestamos')} />
      <Button title="Mi perfil" onPress={() => {
        setNombre(perfil.nombre); setCarnet(perfil.carnet); setCarrera(perfil.carrera); setFoto(perfil.foto); setPantalla('perfil');
      }} />
      {admin && <Button title="Panel administrador" onPress={() => setPantalla('admin')} />}
      {admin && <Button title="Reporte" onPress={() => setPantalla('reporte')} />}
      <Button title="Actualizar datos" onPress={cargar} />
      <Button title="Cerrar sesión" color="firebrick" onPress={() => supabase.auth.signOut()} />
      <Text style={styles.subtitulo}>{pantalla.toUpperCase()}</Text>

      {pantalla === 'equipos' && equipos.map(e => (
        <View key={e.id} style={styles.tarjeta}>
          {fotoVista(e.imagen)}
          <Text style={styles.negrita}>{e.nombre}</Text>
          <Text>{e.descripcion}</Text>
          <Text>{e.disponible ? 'Disponible' : 'No disponible'}</Text>
          {!admin && e.disponible && <Button title="Solicitar préstamo" onPress={() => solicitar(e.id)} />}
        </View>
      ))}

      {pantalla === 'perfil' && <View>
        {fotoVista(foto)}
        {input(nombre, setNombre, 'Nombre completo')}
        {input(carnet, setCarnet, 'Carnet')}
        {input(carrera, setCarrera, 'Carrera')}
        {input(foto, setFoto, 'URL https de foto')}
        <Button title="Guardar perfil" onPress={guardarPerfil} />
      </View>}

      {pantalla === 'prestamos' && prestamos.filter(p => admin || p.usuario_id === usuario).map(p => (
        <View key={p.id} style={styles.tarjeta}>
          <Text style={styles.negrita}>{nombreEquipo(p.equipo_id)}</Text>
          <Text>Fecha de préstamo: {p.fecha_prestamo}</Text>
          <Text>Fecha de devolución: {p.fecha_devolucion}</Text>
          <Text>Estado: {p.estado}</Text>
        </View>
      ))}

      {pantalla === 'admin' && admin && prestamos.map(p => (
        <View key={p.id} style={styles.tarjeta}>
          <Text style={styles.negrita}>{nombreEquipo(p.equipo_id)}</Text>
          <Text>Usuario: {p.usuario_id}</Text>
          <Text>Préstamo: {p.fecha_prestamo} | Devolución: {p.fecha_devolucion}</Text>
          <Text>Estado: {p.estado}</Text>
          {p.estado === 'Pendiente' && <>
            <Button title="Aprobar" onPress={() => cambiar(p.id, 'Aprobado')} />
            <Button title="Rechazar" color="firebrick" onPress={() => cambiar(p.id, 'Rechazado')} />
          </>}
          {p.estado === 'Aprobado' && <Button title="Marcar devuelto" onPress={() => cambiar(p.id, 'Devuelto')} />}
        </View>
      ))}

      {pantalla === 'reporte' && admin && conteo.map((e, i) => (
        <View key={i} style={styles.tarjeta}><Text>{e.nombre}: {e.total} solicitudes</Text></View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: { padding: 20, paddingTop: 55, gap: 10, backgroundColor: '#f7f7f7', flexGrow: 1 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#123456' },
  subtitulo: { fontSize: 19, fontWeight: 'bold', marginTop: 18 },
  tarjeta: { padding: 15, backgroundColor: 'white', borderRadius: 10, marginVertical: 5, gap: 8 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  negrita: { fontWeight: 'bold', fontSize: 17 },
  imagen: { width: 110, height: 110, borderRadius: 8 },
  espacio: { height: 10 },
});
