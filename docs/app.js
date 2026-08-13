import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zyxjuzmeggyjvzgmnvhg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eGp1em1lZ2d5anZ6Z21udmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2Mzg1NTksImV4cCI6MjEwMjIxNDU1OX0.IOiAGG5bejzSQvR1j85flOf9FMMTu0kF6jbl-COjiyk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');

function hoyStr() {
  return new Date().toLocaleDateString('en-CA');
}

function diasHasta(fechaStr) {
  const hoy = new Date(`${hoyStr()}T00:00:00`);
  const objetivo = new Date(`${fechaStr}T00:00:00`);
  return Math.round((objetivo - hoy) / 86400000);
}

function etiquetaVencimiento(fechaStr) {
  const dias = diasHasta(fechaStr);
  if (dias < 0) return 'Vencido';
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

function mostrarApp(mostrar) {
  loginView.classList.toggle('hidden', mostrar);
  appView.classList.toggle('hidden', !mostrar);
  if (mostrar) {
    cargarCitasParaSelect();
    cargarListas();
    cargarResumen();
  }
}

const { data: { session } } = await supabase.auth.getSession();
mostrarApp(!!session);

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  document.getElementById('login-error').textContent = error ? error.message : '';
  if (!error) mostrarApp(true);
});

document.getElementById('logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  mostrarApp(false);
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => cambiarVista(item.dataset.view));
});

function cambiarVista(vista) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === vista);
  });
  ['hoy', 'citas', 'egresos'].forEach((v) => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== vista);
  });
}

document.getElementById('guardar-cita').addEventListener('click', async () => {
  const nombre = document.getElementById('cita-nombre').value.trim();
  const fecha = document.getElementById('cita-fecha').value || null;
  const hora = document.getElementById('cita-hora').value || null;
  const lugar = document.getElementById('cita-lugar').value.trim() || null;
  const descripcion = document.getElementById('cita-descripcion').value.trim() || null;
  if (!nombre) return;

  const { error } = await supabase.from('citas').insert({
    nombre, fecha, hora, lugar, descripcion,
    estado: fecha ? 'programada' : 'pendiente_agendar',
  });
  if (error) return alert(error.message);

  document.getElementById('cita-nombre').value = '';
  document.getElementById('cita-fecha').value = '';
  document.getElementById('cita-hora').value = '';
  document.getElementById('cita-lugar').value = '';
  document.getElementById('cita-descripcion').value = '';
  cargarCitasParaSelect();
  cargarListas();
  cargarResumen();
});

document.querySelectorAll('.agregar-item').forEach((btn) => {
  btn.addEventListener('click', () => agregarFilaItem(btn.dataset.tipo));
});

function agregarFilaItem(tipo) {
  const contenedor = document.getElementById(`items-${tipo}`);
  const fila = document.createElement('div');
  fila.className = 'item-row';
  const placeholders = {
    cita: 'Ej. Cita hepatología',
    examen: 'Ej. Hemograma completo',
    medicina: 'Ej. Losartán 50mg',
  };
  fila.innerHTML = `
    <input type="text" placeholder="${placeholders[tipo]}" />
    <button type="button" aria-label="Quitar">×</button>
  `;
  fila.querySelector('button').addEventListener('click', () => fila.remove());
  contenedor.appendChild(fila);
}

async function cargarCitasParaSelect() {
  const { data, error } = await supabase
    .from('citas')
    .select('id, nombre, fecha')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return;
  const select = document.getElementById('egreso-cita');
  select.innerHTML = data
    .map((c) => `<option value="${c.id}">${c.nombre}${c.fecha ? ' — ' + c.fecha : ''}</option>`)
    .join('');
}

document.getElementById('guardar-egreso').addEventListener('click', async () => {
  const citaOrigenId = document.getElementById('egreso-cita').value;
  const numeroOrden = document.getElementById('egreso-orden').value.trim();
  if (!citaOrigenId || !numeroOrden) return alert('Falta la cita de origen o el número de orden.');

  const { data: egreso, error: errEgreso } = await supabase
    .from('egresos')
    .insert({ cita_origen_id: citaOrigenId, numero_orden: numeroOrden })
    .select()
    .single();
  if (errEgreso) return alert(errEgreso.message);

  const items = [];
  for (const tipo of ['cita', 'examen', 'medicina']) {
    document.querySelectorAll(`#items-${tipo} input`).forEach((input) => {
      const nombre = input.value.trim();
      if (nombre) items.push({ egreso_id: egreso.id, tipo, nombre });
    });
  }

  if (items.length) {
    const { error: errItems } = await supabase.from('egreso_items').insert(items);
    if (errItems) return alert(errItems.message);
  }

  document.getElementById('egreso-orden').value = '';
  ['cita', 'examen', 'medicina'].forEach((tipo) => {
    document.getElementById(`items-${tipo}`).innerHTML = '';
  });
  cargarListas();
  cargarResumen();
});

async function cargarListas() {
  const { data: citas } = await supabase
    .from('citas')
    .select('nombre, fecha, hora, lugar')
    .neq('estado', 'realizada')
    .not('fecha', 'is', null)
    .order('fecha', { ascending: true })
    .limit(20);
  document.getElementById('lista-citas').innerHTML = (citas || [])
    .map((c) => `<li class="list-row">${c.nombre} — ${c.fecha}${c.hora ? ' ' + c.hora : ''}${c.lugar ? ' · ' + c.lugar : ''}</li>`)
    .join('') || '<li class="list-row">No hay citas próximas.</li>';

  const { data: egresos } = await supabase
    .from('egresos')
    .select('numero_orden, created_at')
    .eq('estado', 'pendiente_autorizacion')
    .order('created_at', { ascending: true })
    .limit(20);
  document.getElementById('lista-egresos').innerHTML = (egresos || [])
    .map((e) => `<li class="list-row">Orden N.º ${e.numero_orden}</li>`)
    .join('') || '<li class="list-row">No hay egresos pendientes.</li>';
}

async function cargarResumen() {
  const hoy = hoyStr();

  const { count: citasCount } = await supabase
    .from('citas')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'programada')
    .gte('fecha', hoy);
  document.getElementById('m-citas').textContent = citasCount ?? 0;

  const { count: examenesCount } = await supabase
    .from('egreso_items')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'examen')
    .eq('estado', 'pendiente');
  document.getElementById('m-examenes').textContent = examenesCount ?? 0;

  const { count: medicinasCount } = await supabase
    .from('egreso_items')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'medicina')
    .eq('estado', 'pendiente');
  document.getElementById('m-medicinas').textContent = medicinasCount ?? 0;

  const { data: citasHoy } = await supabase
    .from('citas')
    .select('nombre, hora, lugar')
    .eq('estado', 'programada')
    .eq('fecha', hoy);
  document.getElementById('resumen-hoy').innerHTML = (citasHoy || []).length
    ? citasHoy.map((c) => `
        <div class="card card-accent">
          <p style="font-weight:600; margin:0 0 2px;">${c.nombre}</p>
          <p style="font-size:13px; color:var(--text-secondary); margin:0;">${c.hora ?? 'sin hora'}${c.lugar ? ' · ' + c.lugar : ''}</p>
        </div>`).join('')
    : '<div class="card"><p style="font-size:14px; color:var(--text-secondary); margin:0;">Nada programado para hoy.</p></div>';

  const { data: porVencer } = await supabase
    .from('egreso_items')
    .select('nombre, fecha_vencimiento')
    .eq('estado', 'pendiente')
    .in('tipo', ['examen', 'medicina'])
    .not('fecha_vencimiento', 'is', null)
    .order('fecha_vencimiento', { ascending: true })
    .limit(5);
  document.getElementById('resumen-vencer').innerHTML = (porVencer || []).length
    ? porVencer.map((i) => `
        <li class="list-row">
          <span>${i.nombre}</span>
          <span class="badge badge-warning">${etiquetaVencimiento(i.fecha_vencimiento)}</span>
        </li>`).join('')
    : '<li class="list-row">Nada por vencer.</li>';

  const { data: egresosPendientes } = await supabase
    .from('egresos')
    .select('numero_orden')
    .eq('estado', 'pendiente_autorizacion')
    .order('created_at', { ascending: true })
    .limit(5);
  document.getElementById('resumen-egresos').innerHTML = (egresosPendientes || []).length
    ? egresosPendientes.map((e) => `
        <li class="list-row">
          <span>Orden ${e.numero_orden}</span>
          <span class="badge">Pendiente</span>
        </li>`).join('')
    : '<li class="list-row">Nada pendiente.</li>';
}
