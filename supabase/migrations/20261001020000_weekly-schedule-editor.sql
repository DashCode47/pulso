-- Pulso: schedule is built week by week, not from recurring templates
-- The studio uploads each week's schedule on Sunday, and it changes week to
-- week, so the admin now edits concrete classes per week (/admin/schedule,
-- with "copy previous week" as a starting point) and publishes them.
-- Stop the nightly generator. class_templates, its RPC and the classes it
-- already generated stay as they are: past classes keep their template_id,
-- and future generated ones are just regular classes the admin can edit or
-- cancel.

select cron.unschedule('generate-classes-daily');
