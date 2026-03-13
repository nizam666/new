-- Create a storage bucket for permit documents
insert into storage.buckets (id, name, public)
values ('permit-documents', 'permit-documents', true);

-- Set up storage policies
create policy "Public Access"
on storage.objects for select
using (bucket_id = 'permit-documents');

create policy "Authenticated users can upload permit documents"
on storage.objects for insert
with check (
  bucket_id = 'permit-documents' and
  auth.role() = 'authenticated'
);

create policy "Users can update their own permit documents"
on storage.objects for update
using (
  bucket_id = 'permit-documents' and
  auth.uid() = owner
);

create policy "Users can delete their own permit documents"
on storage.objects for delete
using (
  bucket_id = 'permit-documents' and
  auth.uid() = owner
);
