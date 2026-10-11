-- Separate transaction: PostgreSQL requires a commit before using a new enum value.
alter type public.leave_status add value if not exists 'CANCELLED';
