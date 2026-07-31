-- Owners remain excluded as general assignment targets, but an active owner may
-- assign operational work to their own membership.
do $$
declare
  v_definition text;
  v_function record;
  v_original_predicate constant text :=
    'and membership.role in (''employee'', ''manager'')'
    || E'\n      '
    || 'and membership.status = ''active''';
  v_self_assignment_predicate constant text :=
    'and ('
    || E'\n        '
    || 'membership.role in (''employee'', ''manager'')'
    || E'\n        '
    || 'or ('
    || E'\n          '
    || 'membership.role = ''owner'''
    || E'\n          '
    || 'and membership.id = v_actor.membership_id'
    || E'\n        '
    || ')'
    || E'\n      '
    || ')'
    || E'\n      '
    || 'and membership.status = ''active''';
begin
  for v_function in
    select p.oid, p.proname
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'create_job',
        'reassign_job',
        'update_job'
      ])
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    if strpos(v_definition, v_original_predicate) = 0 then
      raise exception 'expected assignee predicate missing from %',
        v_function.proname;
    end if;
    execute replace(
      v_definition,
      v_original_predicate,
      v_self_assignment_predicate
    );
  end loop;
end;
$$;
