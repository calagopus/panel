-- Custom SQL migration file, put your code below! --

-- Schedule conditions were split into "pre" conditions (server state, resources)
-- and step conditions (variables); they are now one merged type. The three
-- resource condition variants (cpu_usage, memory_usage, disk_usage) were merged
-- into a single resource_usage variant with a metric field. This rewrites all
-- stored condition json (recursively through and/or/not groups) to the new shape.
CREATE FUNCTION pg_temp.rewrite_schedule_condition(condition jsonb) RETURNS jsonb AS $$
DECLARE
	condition_type text;
BEGIN
	IF condition IS NULL OR jsonb_typeof(condition) <> 'object' THEN
		RETURN condition;
	END IF;

	condition_type := condition->>'type';

	IF condition_type IN ('cpu_usage', 'memory_usage', 'disk_usage') THEN
		RETURN jsonb_build_object(
			'type', 'resource_usage',
			'metric', CASE condition_type
				WHEN 'cpu_usage' THEN 'cpu'
				WHEN 'memory_usage' THEN 'memory'
				ELSE 'disk'
			END,
			'comparator', condition->'comparator',
			'value', condition->'value'
		);
	ELSIF condition_type = 'not' THEN
		RETURN jsonb_set(
			condition,
			'{condition}',
			pg_temp.rewrite_schedule_condition(condition->'condition')
		);
	ELSIF condition_type IN ('and', 'or') THEN
		RETURN jsonb_set(
			condition,
			'{conditions}',
			COALESCE(
				(
					SELECT jsonb_agg(pg_temp.rewrite_schedule_condition(nested))
					FROM jsonb_array_elements(condition->'conditions') AS nested
				),
				'[]'::jsonb
			)
		);
	END IF;

	RETURN condition;
END;
$$ LANGUAGE plpgsql;

UPDATE server_schedules
SET condition = pg_temp.rewrite_schedule_condition(condition);

UPDATE server_schedule_steps
SET action = jsonb_set(
	action,
	'{condition}',
	pg_temp.rewrite_schedule_condition(action->'condition')
)
WHERE action->>'type' IN ('ensure', 'if', 'else_if')
	AND action ? 'condition';

DROP FUNCTION pg_temp.rewrite_schedule_condition(jsonb);
