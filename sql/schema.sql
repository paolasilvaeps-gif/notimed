create table citas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha date,
  hora time,
  lugar text,
  descripcion text,
  estado text not null default 'pendiente_agendar'
    check (estado in ('pendiente_agendar','programada','realizada')),
  recordatorio_vispera_enviado boolean not null default false,
  recordatorio_mismodia_enviado boolean not null default false,
  created_at timestamptz not null default now()
);

create table egresos (
  id uuid primary key default gen_random_uuid(),
  cita_origen_id uuid not null references citas(id),
  numero_orden text not null,
  created_at timestamptz not null default now()
);

-- La autorización de la EPS es por ítem, no por egreso completo: cada cita,
-- examen o medicina se autoriza en su propio momento.
create table egreso_items (
  id uuid primary key default gen_random_uuid(),
  egreso_id uuid not null references egresos(id),
  tipo text not null check (tipo in ('cita','examen','medicina')),
  nombre text not null,
  numero_autorizacion text,
  fecha_vencimiento date,
  documento_url text,
  estado text not null default 'pendiente_autorizacion'
    check (estado in ('pendiente_autorizacion','autorizado','completado')),
  cita_generada_id uuid references citas(id),
  ultimo_recordatorio date,
  created_at timestamptz not null default now()
);

create index idx_citas_fecha on citas(fecha) where estado = 'programada';
create index idx_items_vencimiento on egreso_items(fecha_vencimiento) where estado = 'autorizado';
create index idx_items_pendientes on egreso_items(estado) where estado = 'pendiente_autorizacion';

-- El anon key queda visible en el código del formulario web, así que sin RLS
-- cualquiera que lo consiga podría leer las citas y medicinas. Estas políticas
-- exigen sesión iniciada (auth.role() = 'authenticated'); el script de
-- recordatorios usa el service_role key, que siempre pasa por encima de RLS.
alter table citas enable row level security;
alter table egresos enable row level security;
alter table egreso_items enable row level security;

create policy "solo autenticados" on citas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo autenticados" on egresos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "solo autenticados" on egreso_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
