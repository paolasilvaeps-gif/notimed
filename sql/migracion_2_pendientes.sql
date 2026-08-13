-- La autorización de la EPS pasa de ser del egreso completo a ser de cada
-- ítem por separado (una cita, examen o medicina puede autorizarse en un
-- momento distinto a las demás del mismo egreso). El egreso queda solo
-- como agrupador (número de orden + de qué cita salió).

alter table egresos drop column if exists estado;
alter table egresos drop column if exists fecha_autorizacion;
alter table egresos drop column if exists ultimo_recordatorio;
drop index if exists idx_egresos_estado;

alter table egreso_items add column if not exists documento_url text;

alter table egreso_items drop constraint if exists egreso_items_estado_check;
update egreso_items set estado = 'pendiente_autorizacion' where estado = 'pendiente';
alter table egreso_items add constraint egreso_items_estado_check
  check (estado in ('pendiente_autorizacion','autorizado','completado'));
alter table egreso_items alter column estado set default 'pendiente_autorizacion';

drop index if exists idx_items_vencimiento;
create index idx_items_vencimiento on egreso_items(fecha_vencimiento) where estado = 'autorizado';
create index idx_items_pendientes on egreso_items(estado) where estado = 'pendiente_autorizacion';
