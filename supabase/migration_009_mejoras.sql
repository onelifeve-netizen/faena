-- Mejoras de usabilidad: moneda de origen del precio de compra de cada
-- equipo (para convertir a la moneda de referencia, igual que en obras),
-- y días de anticipación para el recordatorio de cada mantenimiento.
-- Correr después de migration_008_perfil_contactos_depreciacion.sql.

alter table machines add column if not exists purchase_price_currency text not null default 'ARS';
alter table machines add column if not exists purchase_price_fx_rate numeric not null default 1;

alter table maintenance_schedules add column if not exists reminder_days_before integer not null default 7;

-- La vista de depreciación ahora calcula todo en la moneda de referencia
-- (precio de compra × su cotización), igual que el resto de la app.
create or replace view machine_depreciation as
select
  m.id as machine_id,
  m.purchase_price,
  m.purchase_price_currency,
  m.purchase_price_fx_rate,
  (m.purchase_price * m.purchase_price_fx_rate) as purchase_price_ref,
  m.purchase_date,
  m.useful_life_years,
  case when m.purchase_price is not null and m.useful_life_years > 0
    then round((m.purchase_price * m.purchase_price_fx_rate) / m.useful_life_years, 2)
    else null
  end as annual_depreciation,
  case when m.purchase_date is not null
    then greatest(0, extract(year from age(current_date, m.purchase_date))
                     + extract(month from age(current_date, m.purchase_date)) / 12.0)
    else null
  end as years_elapsed,
  case when m.purchase_price is not null and m.useful_life_years > 0 and m.purchase_date is not null
    then greatest(0, (m.purchase_price * m.purchase_price_fx_rate) - ((m.purchase_price * m.purchase_price_fx_rate) / m.useful_life_years) *
         least(m.useful_life_years, extract(year from age(current_date, m.purchase_date))
                                     + extract(month from age(current_date, m.purchase_date)) / 12.0))
    else null
  end as book_value,
  coalesce(wo.total_cost, 0) as maintenance_cost_total
from machines m
left join (
  select machine_id, sum(cost) as total_cost from work_orders where cost is not null group by machine_id
) wo on wo.machine_id = m.id;
