-- Pulso: seed test class templates
-- 4 back-to-back hourly classes, Monday-Friday, starting 7am. Test data to
-- validate generate_classes_from_templates() end to end -- adjust real
-- studio schedule from the admin panel once it exists.
insert into class_templates (title, trainer_name, day_of_week, start_time, duration_minutes, capacity)
select 'Cycling', 'Trainer TBD', dow, start_time, 60, 12
from generate_series(1, 5) as dow -- Monday(1)-Friday(5)
cross join (values ('07:00'::time), ('08:00'), ('09:00'), ('10:00')) as s(start_time);

select generate_classes_from_templates(28);
