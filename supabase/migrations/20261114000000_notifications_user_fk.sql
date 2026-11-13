-- 운영 notifications.user_id 에 users 외래 키가 없어 탈퇴·삭제한 계정의 알림이 남았다(11/13 확인 82건, 11/14 orbit42-backups 에 백업 뒤 적용). 순서: 삭제 → FK.
-- 적용 전 scripts 백업(orbit42-backups/20261114-orphan-notifications.json)을 먼저 만든다.
delete from public.notifications n where not exists (select 1 from public.users u where u.id = n.user_id);
alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.notifications
  add constraint notifications_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade;
