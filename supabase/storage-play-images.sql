insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'play-images',
  'play-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "play images public read" on storage.objects;
drop policy if exists "play images admin insert" on storage.objects;
drop policy if exists "play images admin update" on storage.objects;
drop policy if exists "play images admin delete" on storage.objects;

create policy "play images public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'play-images');

create policy "play images admin insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'play-images' and public.is_admin(auth.uid()));

create policy "play images admin update"
on storage.objects for update
to authenticated
using (bucket_id = 'play-images' and public.is_admin(auth.uid()))
with check (bucket_id = 'play-images' and public.is_admin(auth.uid()));

create policy "play images admin delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'play-images' and public.is_admin(auth.uid()));
