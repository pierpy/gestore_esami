-- Gestore Esami - schema Supabase (Postgres)
-- Da eseguire nel SQL editor del progetto Supabase (https://supabase.com, tier gratuito).
-- Ogni docente vede solo i propri dati grazie alla Row Level Security basata su auth.uid().

create extension if not exists "pgcrypto";

-- Corsi: uno per anno accademico
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  anno_accademico text not null, -- es. "2025/2026"
  created_at timestamptz not null default now()
);

-- Appelli: sessioni d'esame di un corso (es. "Appello Gennaio 2026")
create table if not exists public.appelli (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  nome text not null,
  data date not null default current_date,
  created_at timestamptz not null default now()
);

-- Studenti iscritti a un corso
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  matricola text,
  cognome text not null,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (course_id, matricola)
);

-- Voti: scritto (spesso da scansione) + orale, per studente/appello
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  appello_id uuid not null references public.appelli(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  voto_scritto numeric(4,1),
  lode boolean not null default false,
  voto_orale numeric(4,1),
  note text,
  scansionato boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appello_id, student_id)
);

create index if not exists idx_appelli_course on public.appelli(course_id);
create index if not exists idx_students_course on public.students(course_id);
create index if not exists idx_grades_appello on public.grades(appello_id);
create index if not exists idx_grades_student on public.grades(student_id);

-- updated_at automatico su grades
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_grades_updated_at on public.grades;
create trigger trg_grades_updated_at
  before update on public.grades
  for each row execute function public.set_updated_at();

-- Row Level Security: un docente vede/modifica solo i dati dei propri corsi
alter table public.courses enable row level security;
alter table public.appelli enable row level security;
alter table public.students enable row level security;
alter table public.grades enable row level security;

drop policy if exists "courses_owner" on public.courses;
create policy "courses_owner" on public.courses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "appelli_owner" on public.appelli;
create policy "appelli_owner" on public.appelli
  for all using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "students_owner" on public.students;
create policy "students_owner" on public.students
  for all using (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())
  );

drop policy if exists "grades_owner" on public.grades;
create policy "grades_owner" on public.grades
  for all using (
    exists (
      select 1 from public.appelli a
      join public.courses c on c.id = a.course_id
      where a.id = appello_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.appelli a
      join public.courses c on c.id = a.course_id
      where a.id = appello_id and c.user_id = auth.uid()
    )
  );
