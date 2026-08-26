-- Pulso: seed studio bike inventory
-- The bikes table was never seeded, so every class showed 0 free bikes
-- regardless of capacity. 12 bikes, labeled to match typical capacity.
insert into bikes (label, active)
select 'Bike ' || n, true
from generate_series(1, 12) as n
on conflict (label) do nothing;
