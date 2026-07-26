-- 시간 자산화: 사용자의 급여 기준으로 "내 1시간의 가치"를 환산하기 위한 필드.
-- income_type: 'monthly'(월급, 원) | 'hourly'(시급, 원). 시급 환산은 월 209시간
-- (한국 근로기준 소정근로 기준) 사용.
ALTER TABLE users ADD COLUMN IF NOT EXISTS income_type text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS income_amount bigint;
