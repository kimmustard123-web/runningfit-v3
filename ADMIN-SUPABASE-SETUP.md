# RunningFit 관리자 최종 설정

현재 공개 사이트의 러닝화 페이지·홈 TOP 목록은 Supabase `shoes` 테이블을 사용합니다.
관리자에서 추가·수정·숨김·삭제까지 사용하려면 Vercel 환경변수 2개를 더 등록해야 합니다.

## Vercel > runningfit-v3 > Environment Variables

### 1. SUPABASE_SECRET_KEY
- Key: `SUPABASE_SECRET_KEY`
- Value: Supabase > Settings > API Keys > Secret key의 `sb_secret_...` 전체 값
- Sensitive: 켜기
- Environment: Production and Preview

이 값은 서버 함수에서만 사용되며 브라우저로 전달되지 않습니다.

### 2. ADMIN_PASSWORD
- Key: `ADMIN_PASSWORD`
- Value: 본인만 아는 긴 관리자 비밀번호
- Sensitive: 켜기
- Environment: Production and Preview

두 값을 저장한 뒤 Vercel Deployments에서 최신 배포를 Redeploy 합니다.

## 관리자 주소

`https://runningfit-v3.vercel.app/admin/`

로그인 화면에는 `ADMIN_PASSWORD`에 지정한 비밀번호만 입력합니다.

## 확인 주소

- 공개 API: `/api/shoes`
- 관리자 로그인 상태: `/api/admin-session`
- 관리자 페이지: `/admin/`
