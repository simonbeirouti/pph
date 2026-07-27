begin;

select plan(47);

select has_table('public', 'job_assets', 'job evidence metadata exists');
select has_table(
  'public',
  'job_notification_deliveries',
  'submission email delivery ledger exists'
);
select is(
  (select public from storage.buckets where id = 'job-evidence'),
  false,
  'job evidence bucket is private'
);
select ok(
  (
    select allowed_mime_types @> array['image/heic', 'image/heif']
    from storage.buckets
    where id = 'job-evidence'
  ),
  'job evidence bucket accepts iPhone and Android native image formats'
);
select has_function('public', 'start_job', array['bigint'], 'start transition exists');
select has_function('public', 'add_job_note', array['bigint', 'text'], 'note RPC exists');
select has_function('public', 'add_job_comment', array['bigint', 'text'], 'comment RPC exists');
select has_function(
  'public',
  'finalize_job_evidence',
  array['bigint', 'text', 'text', 'bigint'],
  'evidence finalization exists'
);
select has_function(
  'public',
  'archive_job_evidence',
  array['bigint', 'bigint'],
  'evidence removal exists'
);
select has_function('public', 'submit_job', array['bigint'], 'submit transition exists');
select has_function(
  'public',
  'reopen_job',
  array['bigint', 'text', 'bigint'],
  'feedback-gated reopen exists'
);
select has_function('public', 'archive_job', array['bigint'], 'archive transition exists');
select has_function(
  'public',
  'retry_job_notification',
  array['bigint'],
  'notification retry preparation exists'
);
select ok(
  not has_table_privilege('authenticated', 'public.job_assets', 'INSERT'),
  'authenticated users cannot insert evidence metadata directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.job_updates', 'UPDATE'),
  'authenticated users cannot mutate audit history'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  $$
    select public.create_job(
      p_title => 'S05 database journey',
      p_assignee_membership_id => 1103,
      p_requires_completion_note => true,
      p_minimum_completion_photos => 1
    )
  $$,
  'owner creates a job with submission requirements'
);
select lives_ok(
  $$
    select public.create_job(
      p_title => 'S05 HEIF format',
      p_assignee_membership_id => 1103
    )
  $$,
  'owner creates an isolated job for HEIF evidence validation'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select is(
  (
    select (public.start_job(
      (select id from public.jobs where title = 'S05 database journey')
    )).status::text
  ),
  'in_progress',
  'assigned employee starts the job'
);
select lives_ok(
  $$
    select public.start_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  'starting an in-progress job is idempotent'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'S05 database journey')
      and type = 'status_change'
      and metadata ->> 'new_status' = 'in_progress'
  ),
  1::bigint,
  'idempotent start does not duplicate history'
);
select throws_like(
  $$
    select public.submit_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  '%add a completion note%',
  'submission validates the required employee note'
);
select lives_ok(
  $$
    select public.add_job_note(
      (select id from public.jobs where title = 'S05 database journey'),
      'Completed the inspection.'
    )
  $$,
  'employee adds an immutable work note'
);
select lives_ok(
  $$
    select public.finalize_job_evidence(
      (select id from public.jobs where title = 'S05 database journey'),
      '1001/' ||
        (select id from public.jobs where title = 'S05 database journey')::text ||
        '/1103/00000000-0000-4000-8000-000000000001.heic',
      'image/heic',
      1024
    )
  $$,
  'employee finalizes valid HEIC completion evidence metadata'
);
select lives_ok(
  $$
    select public.finalize_job_evidence(
      (select id from public.jobs where title = 'S05 HEIF format'),
      '1001/' ||
        (select id from public.jobs where title = 'S05 HEIF format')::text ||
        '/1103/00000000-0000-4000-8000-000000000002.heif',
      'image/heif',
      1024
    )
  $$,
  'employee finalizes valid HEIF completion evidence metadata'
);
select throws_like(
  $$
    select public.finalize_job_evidence(
      (select id from public.jobs where title = 'S05 database journey'),
      '1001/' ||
        (select id from public.jobs where title = 'S05 database journey')::text ||
        '/1103/00000000-0000-4000-8000-000000000003.avif',
      'image/avif',
      1024
    )
  $$,
  '%invalid evidence path%',
  'unsupported phone image formats remain rejected'
);
select lives_ok(
  $$
    select public.submit_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  'employee submits when requirements pass'
);
select is(
  (
    select status::text
    from public.jobs
    where title = 'S05 database journey'
  ),
  'in_review',
  'submission moves the job to review'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is(
  (
    select recipient_membership_id
    from public.job_notification_deliveries
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  1101::bigint,
  'submission snapshots only the creator-owner recipient'
);
select is(
  (
    select recipient_email
    from public.job_notification_deliveries
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  'owner@example.test',
  'submission snapshots the creator-owner email'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select lives_ok(
  $$
    select public.submit_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  'submission replay is idempotent'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is(
  (
    select count(*)
    from public.job_notification_deliveries
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  1::bigint,
  'submission replay does not duplicate notification delivery'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select throws_like(
  $$
    select public.archive_job_evidence(
      (select id from public.jobs where title = 'S05 database journey'),
      (
        select id from public.job_assets
        where job_id = (select id from public.jobs where title = 'S05 database journey')
      )
    )
  $$,
  '%submitted evidence cannot be removed%',
  'submitted evidence is read-only'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select lives_ok(
  $$
    select public.add_job_comment(
      (select id from public.jobs where title = 'S05 database journey'),
      'Owner review comment.'
    )
  $$,
  'owner comments without changing review status'
);
select throws_like(
  $$
    select public.reassign_job(
      (select id from public.jobs where title = 'S05 database journey'),
      null
    )
  $$,
  '%owner feedback is required to reopen this job%',
  'existing reassignment cannot bypass reopen feedback'
);
select throws_like(
  $$
    select public.reopen_job(
      (select id from public.jobs where title = 'S05 database journey'),
      ' ',
      1103
    )
  $$,
  '%owner feedback is required%',
  'reopen rejects blank feedback'
);
select lives_ok(
  $$
    select public.reopen_job(
      (select id from public.jobs where title = 'S05 database journey'),
      'Please photograph the final label.',
      1103
    )
  $$,
  'owner reopens with feedback and an active assignee'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'S05 database journey')
      and type = 'comment'
      and metadata ->> 'event' = 'reopen_feedback'
  ),
  1::bigint,
  'reopen feedback is tagged in immutable history'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'S05 database journey')
      and type = 'note'
  ),
  1::bigint,
  'reopen preserves earlier work notes'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);
select lives_ok(
  $$
    select public.submit_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  'employee resubmits while preserved requirements remain valid'
);
select is(
  (
    select count(*)
    from public.job_notification_deliveries
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  0::bigint,
  'employee cannot read owner-only notification deliveries'
);
select is(
  (
    select count(*)
    from public.job_assets
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  1::bigint,
  'current assignee can read active preserved evidence'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select is(
  (
    select count(*)
    from public.job_notification_deliveries
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  2::bigint,
  'each distinct submission has one durable email delivery'
);
select lives_ok(
  $$
    select public.archive_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  'owner approves and archives an in-review job'
);
select lives_ok(
  $$
    select public.archive_job(
      (select id from public.jobs where title = 'S05 database journey')
    )
  $$,
  'archive replay is idempotent'
);
select is(
  (
    select count(*)
    from public.job_updates
    where job_id = (select id from public.jobs where title = 'S05 database journey')
      and type = 'status_change'
      and metadata ->> 'new_status' = 'archived'
  ),
  1::bigint,
  'archive replay does not duplicate history'
);
select throws_like(
  $$
    update public.job_updates
    set body = 'rewritten'
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  $$,
  '%permission denied%',
  'authenticated users cannot rewrite audit updates'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000004',
  true
);
select is(
  (
    select count(*)
    from public.job_assets
    where job_id = (select id from public.jobs where title = 'S05 database journey')
  ),
  0::bigint,
  'cross-organisation owner cannot read evidence'
);

select * from finish();
rollback;
