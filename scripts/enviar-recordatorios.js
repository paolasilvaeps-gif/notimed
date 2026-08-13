import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;
const DIAS_ENTRE_RECORDATORIOS = 3;

function ahoraEnBogota() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    fecha: `${get('year')}-${get('month')}-${get('day')}`,
    hora: Number(get('hour')),
    minuto: Number(get('minute')),
  };
}

function sumarDias(fechaStr, dias) {
  const d = new Date(`${fechaStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function horasHasta(fecha, hora, fechaActual, horaActual, minutoActual) {
  const objetivo = new Date(`${fecha}T${hora}-05:00`);
  const ahora = new Date(`${fechaActual}T${String(horaActual).padStart(2, '0')}:${String(minutoActual).padStart(2, '0')}:00-05:00`);
  return (objetivo - ahora) / 3600000;
}

async function main() {
  const { fecha: hoy, hora: horaActual, minuto: minutoActual } = ahoraEnBogota();
  const manana = sumarDias(hoy, 1);
  const limiteRecordatorio = sumarDias(hoy, -DIAS_ENTRE_RECORDATORIOS);

  const secciones = [];

  const { data: citasHoy, error: errCitasHoy } = await supabase
    .from('citas')
    .select('id, nombre, hora, lugar')
    .eq('estado', 'programada')
    .eq('fecha', hoy)
    .eq('recordatorio_mismodia_enviado', false)
    .not('hora', 'is', null);
  if (errCitasHoy) throw errCitasHoy;

  const citasMismoDia = (citasHoy || []).filter((c) => {
    const restante = horasHasta(hoy, c.hora, hoy, horaActual, minutoActual);
    return restante > 0 && restante <= 3;
  });
  if (citasMismoDia.length) {
    secciones.push({
      titulo: 'Hoy',
      items: citasMismoDia.map((c) => `${c.nombre} — ${c.hora}${c.lugar ? ' en ' + c.lugar : ''}`),
    });
  }

  let citasManana = [];
  if (horaActual === 20) {
    const { data, error } = await supabase
      .from('citas')
      .select('id, nombre, hora, lugar')
      .eq('estado', 'programada')
      .eq('fecha', manana)
      .eq('recordatorio_vispera_enviado', false);
    if (error) throw error;
    citasManana = data || [];
    if (citasManana.length) {
      secciones.push({
        titulo: 'Mañana',
        items: citasManana.map((c) => `${c.nombre} — ${c.hora ?? 'sin hora'}${c.lugar ? ' en ' + c.lugar : ''}`),
      });
    }
  }

  let egresosPendientes = [];
  if (horaActual === 8) {
    const { data, error } = await supabase
      .from('egresos')
      .select('id, numero_orden, ultimo_recordatorio')
      .eq('estado', 'pendiente_autorizacion')
      .or(`ultimo_recordatorio.is.null,ultimo_recordatorio.lte.${limiteRecordatorio}`);
    if (error) throw error;
    egresosPendientes = data || [];
    if (egresosPendientes.length) {
      secciones.push({
        titulo: 'Autorizaciones EPS pendientes',
        items: egresosPendientes.map((e) => `Orden N.º ${e.numero_orden}`),
      });
    }
  }

  let itemsPorVencer = [];
  if (horaActual === 8) {
    const { data, error } = await supabase
      .from('egreso_items')
      .select('id, nombre, tipo, fecha_vencimiento, ultimo_recordatorio')
      .eq('estado', 'pendiente')
      .in('tipo', ['examen', 'medicina'])
      .not('fecha_vencimiento', 'is', null)
      .gte('fecha_vencimiento', hoy)
      .or(`ultimo_recordatorio.is.null,ultimo_recordatorio.lte.${limiteRecordatorio}`);
    if (error) throw error;
    itemsPorVencer = data || [];
    if (itemsPorVencer.length) {
      secciones.push({
        titulo: 'Exámenes y medicinas por reclamar',
        items: itemsPorVencer.map((i) => `${i.nombre} — vence ${i.fecha_vencimiento}`),
      });
    }
  }

  if (!secciones.length) {
    console.log('Nada que recordar en esta ejecución.');
    return;
  }

  const html = secciones
    .map((s) => `<h3>${s.titulo}</h3><ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>`)
    .join('');

  await resend.emails.send({
    from: 'NotiMed <onboarding@resend.dev>',
    to: NOTIFY_EMAIL,
    subject: 'NotiMed: tienes pendientes',
    html,
  });

  if (citasMismoDia.length) {
    await supabase.from('citas').update({ recordatorio_mismodia_enviado: true }).in('id', citasMismoDia.map((c) => c.id));
  }
  if (citasManana.length) {
    await supabase.from('citas').update({ recordatorio_vispera_enviado: true }).in('id', citasManana.map((c) => c.id));
  }
  if (egresosPendientes.length) {
    await supabase.from('egresos').update({ ultimo_recordatorio: hoy }).in('id', egresosPendientes.map((e) => e.id));
  }
  if (itemsPorVencer.length) {
    await supabase.from('egreso_items').update({ ultimo_recordatorio: hoy }).in('id', itemsPorVencer.map((i) => i.id));
  }

  console.log(`Correo enviado con ${secciones.length} sección(es).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
