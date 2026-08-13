import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zyxjuzmeggyjvzgmnvhg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5eGp1em1lZ2d5anZ6Z21udmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2Mzg1NTksImV4cCI6MjEwMjIxNDU1OX0.IOiAGG5bejzSQvR1j85flOf9FMMTu0kF6jbl-COjiyk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');

const ETIQUETAS_TIPO = { cita: 'Cita', examen: 'Examen', medicina: 'Medicina' };

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
    cargarPendientes();
    cargarPorAgendar();
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

document.getElementById('toggle-password').addEventListener('click', () => {
  const input = document.getElementById('password');
  const icon = document.querySelector('#toggle-password i');
  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  icon.className = mostrar ? 'ti ti-eye-off' : 'ti ti-eye';
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => cambiarVista(item.dataset.view));
});

function cambiarVista(vista) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === vista);
  });
  ['hoy', 'citas', 'egresos', 'pendientes'].forEach((v) => {
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
  cargarPorAgendar();
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
  const { data: usadas } = await supabase.from('egresos').select('cita_origen_id');
  const idsUsados = new Set((usadas || []).map((e) => e.cita_origen_id));

  const { data, error } = await supabase
    .from('citas')
    .select('id, nombre, fecha')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return;

  const disponibles = (data || []).filter((c) => !idsUsados.has(c.id));
  const select = document.getElementById('egreso-cita');
  select.innerHTML = disponibles.length
    ? disponibles.map((c) => `<option value="${c.id}">${c.nombre}${c.fecha ? ' — ' + c.fecha : ''}</option>`).join('')
    : '<option value="">No hay citas disponibles</option>';
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
  cargarCitasParaSelect();
  cargarListas();
  cargarResumen();
  cargarPendientes();
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
    .order('created_at', { ascending: false })
    .limit(20);
  document.getElementById('lista-egresos').innerHTML = (egresos || [])
    .map((e) => `<li class="list-row">Orden N.º ${e.numero_orden}</li>`)
    .join('') || '<li class="list-row">No hay egresos todavía.</li>';
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
    .eq('estado', 'autorizado');
  document.getElementById('m-examenes').textContent = examenesCount ?? 0;

  const { count: medicinasCount } = await supabase
    .from('egreso_items')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'medicina')
    .eq('estado', 'autorizado');
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
    .select('nombre, fecha_vencimiento, documento_url')
    .eq('estado', 'autorizado')
    .in('tipo', ['examen', 'medicina'])
    .not('fecha_vencimiento', 'is', null)
    .order('fecha_vencimiento', { ascending: true })
    .limit(5);
  document.getElementById('resumen-vencer').innerHTML = (porVencer || []).length
    ? porVencer.map((i) => `
        <li class="list-row">
          <span>${i.nombre}${i.documento_url ? ` · <a href="${i.documento_url}" target="_blank" rel="noopener noreferrer">Ir a documento</a>` : ''}</span>
          <span class="badge badge-warning">${etiquetaVencimiento(i.fecha_vencimiento)}</span>
        </li>`).join('')
    : '<li class="list-row">Nada por vencer.</li>';

  const { data: pendientesPreview } = await supabase
    .from('egreso_items')
    .select('nombre, tipo')
    .eq('estado', 'pendiente_autorizacion')
    .order('created_at', { ascending: true })
    .limit(5);
  document.getElementById('resumen-egresos').innerHTML = (pendientesPreview || []).length
    ? pendientesPreview.map((i) => `
        <li class="list-row" style="cursor:pointer;" data-ir-pendientes>
          <span>${i.nombre}</span>
          <span class="badge">${ETIQUETAS_TIPO[i.tipo]}</span>
        </li>`).join('')
    : '<li class="list-row">Nada pendiente.</li>';
  document.querySelectorAll('[data-ir-pendientes]').forEach((row) => {
    row.addEventListener('click', () => cambiarVista('pendientes'));
  });
}

async function cargarPendientes() {
  const { data, error } = await supabase
    .from('egreso_items')
    .select('id, tipo, nombre, egresos(numero_orden)')
    .eq('estado', 'pendiente_autorizacion')
    .order('created_at', { ascending: true });
  if (error) return;
  const pendientes = data || [];

  const badge = document.getElementById('nav-badge-pendientes');
  badge.textContent = pendientes.length;
  badge.classList.toggle('hidden', pendientes.length === 0);

  const contenedor = document.getElementById('lista-pendientes');
  contenedor.innerHTML = pendientes.length
    ? pendientes.map((item) => plantillaPendiente(item)).join('')
    : '<div class="card"><p style="font-size:14px; color:var(--text-secondary); margin:0;">No hay nada pendiente de autorizar.</p></div>';

  contenedor.querySelectorAll('.pending-item-row').forEach((row) => {
    row.addEventListener('click', () => {
      row.closest('.pending-item').querySelector('.pending-form').classList.toggle('hidden');
    });
  });

  contenedor.querySelectorAll('.autorizar-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await autorizarItem(btn.dataset.id, btn.dataset.tipo, btn.closest('.pending-item'));
    });
  });
}

function plantillaPendiente(item) {
  const orden = item.egresos ? `Orden ${item.egresos.numero_orden}` : '';
  const camposTipo = item.tipo === 'cita'
    ? '<p style="font-size:12px; color:var(--text-secondary); margin:8px 0 0;">Al guardar queda en "Por agendar" en la pestaña Citas — ahí le pones fecha, hora y lugar cuando llames a pedirla.</p>'
    : `
      <label>Fecha de vencimiento de la autorización</label>
      <input type="date" class="p-vencimiento" />
      <label>Link al documento (Google Drive, opcional)</label>
      <input type="url" class="p-documento" placeholder="https://drive.google.com/..." />`;

  return `
    <div class="pending-item" data-id="${item.id}">
      <div class="pending-item-row">
        <div>
          <p class="pending-item-name">${item.nombre}</p>
          <p class="pending-item-meta">${ETIQUETAS_TIPO[item.tipo]}${orden ? ' · ' + orden : ''}</p>
        </div>
        <span class="badge">${ETIQUETAS_TIPO[item.tipo]}</span>
      </div>
      <div class="pending-form hidden">
        <label>Número de autorización</label>
        <input type="text" class="p-autorizacion" placeholder="Ej. A123456789" />
        ${camposTipo}
        <button type="button" class="btn-primary autorizar-btn" data-id="${item.id}" data-tipo="${item.tipo}">Guardar autorización</button>
      </div>
    </div>`;
}

async function autorizarItem(id, tipo, cardEl) {
  const numeroAutorizacion = cardEl.querySelector('.p-autorizacion').value.trim();
  if (!numeroAutorizacion) return alert('Falta el número de autorización.');

  if (tipo === 'cita') {
    const nombre = cardEl.querySelector('.pending-item-name').textContent;
    const { data: nuevaCita, error: errCita } = await supabase
      .from('citas')
      .insert({ nombre, estado: 'pendiente_agendar' })
      .select()
      .single();
    if (errCita) return alert(errCita.message);

    const { error } = await supabase
      .from('egreso_items')
      .update({ numero_autorizacion: numeroAutorizacion, estado: 'autorizado', cita_generada_id: nuevaCita.id })
      .eq('id', id);
    if (error) return alert(error.message);
  } else {
    const fechaVencimiento = cardEl.querySelector('.p-vencimiento').value || null;
    const documentoUrl = cardEl.querySelector('.p-documento').value.trim() || null;
    if (!fechaVencimiento) return alert('Falta la fecha de vencimiento.');

    const { error } = await supabase
      .from('egreso_items')
      .update({
        numero_autorizacion: numeroAutorizacion,
        fecha_vencimiento: fechaVencimiento,
        documento_url: documentoUrl,
        estado: 'autorizado',
      })
      .eq('id', id);
    if (error) return alert(error.message);
  }

  cargarPendientes();
  cargarResumen();
  cargarCitasParaSelect();
  cargarListas();
  cargarPorAgendar();
}

async function cargarPorAgendar() {
  const { data, error } = await supabase
    .from('citas')
    .select('id, nombre')
    .eq('estado', 'pendiente_agendar')
    .order('created_at', { ascending: true });
  if (error) return;
  const citas = data || [];

  const contenedor = document.getElementById('lista-por-agendar');
  contenedor.innerHTML = citas.length
    ? citas.map((c) => plantillaPorAgendar(c)).join('')
    : '<div class="card"><p style="font-size:14px; color:var(--text-secondary); margin:0;">No hay citas por agendar.</p></div>';

  contenedor.querySelectorAll('.pending-item-row').forEach((row) => {
    row.addEventListener('click', () => {
      row.closest('.pending-item').querySelector('.pending-form').classList.toggle('hidden');
    });
  });

  contenedor.querySelectorAll('.agendar-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await agendarCita(btn.dataset.id, btn.closest('.pending-item'));
    });
  });
}

function plantillaPorAgendar(cita) {
  return `
    <div class="pending-item" data-id="${cita.id}">
      <div class="pending-item-row">
        <div>
          <p class="pending-item-name">${cita.nombre}</p>
          <p class="pending-item-meta">Falta llamar a pedir la fecha</p>
        </div>
        <span class="badge">Por agendar</span>
      </div>
      <div class="pending-form hidden">
        <label>Fecha</label>
        <input type="date" class="p-fecha" />
        <label>Hora</label>
        <input type="time" class="p-hora" />
        <label>Lugar</label>
        <input type="text" class="p-lugar" placeholder="Ej. Clínica del Norte" />
        <button type="button" class="btn-primary agendar-btn" data-id="${cita.id}">Guardar fecha</button>
      </div>
    </div>`;
}

async function agendarCita(id, cardEl) {
  const fecha = cardEl.querySelector('.p-fecha').value || null;
  const hora = cardEl.querySelector('.p-hora').value || null;
  const lugar = cardEl.querySelector('.p-lugar').value.trim() || null;
  if (!fecha) return alert('Falta la fecha de la cita.');

  const { error } = await supabase
    .from('citas')
    .update({ fecha, hora, lugar, estado: 'programada' })
    .eq('id', id);
  if (error) return alert(error.message);

  cargarPorAgendar();
  cargarListas();
  cargarResumen();
  cargarCitasParaSelect();
}
