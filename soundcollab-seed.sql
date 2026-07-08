-- ============================================================
--  Sound Collab — example listings (one per side)
--  Run after soundcollab-setup.sql. Safe to re-run.
-- ============================================================

insert into public.sound_projects
  (id, title, project_type, sounds_needed, description, contact, author, slots, status)
values
  (
    'seed-project-remnants',
    'Remnants of Our Days',
    'games',
    'Soundscape,Ambient,SFX',
    'A Unity HDRP gacha installation critiquing predatory design systems. Looking for a layered ambient bed plus tactile UI/interaction SFX that reinforce the weight of each pull.',
    'student@student.rmit.edu.au',
    'Student Name',
    2,
    'open'
  )
on conflict (id) do nothing;

insert into public.sound_designers
  (id, name, website, bio, contact, sample_urls)
values
  (
    'seed-designer-example',
    'Jordan Lee',
    'https://soundcloud.com/example',
    'Sound design student focused on foley and ambient textures for games and interactive installation. Available for Studio 2 & 3 collaborations, quick turnaround on short pieces.',
    'jordan.lee@student.rmit.edu.au',
    ''
  )
on conflict (id) do nothing;
