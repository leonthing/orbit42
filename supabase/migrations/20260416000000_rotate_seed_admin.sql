-- Rotate the historical 'leo' seed password. The earlier migration
-- hardcoded 'orbit42admin' in source; anyone who read the repo could
-- have signed in. This replaces the hash with a random one so that
-- seed password no longer works. The legitimate owner should use the
-- /forgot-password flow to set a new password.
do $$
declare
  random_pw text := encode(gen_random_bytes(24), 'hex');
begin
  update public.users
  set password_hash = crypt(random_pw, gen_salt('bf')),
      updated_at = now()
  where username = 'leo'
    and password_hash = crypt('orbit42admin', password_hash);
end $$;
