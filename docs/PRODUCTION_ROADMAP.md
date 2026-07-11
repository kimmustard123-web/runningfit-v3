# RunningFit 상용 운영 전환

## 현재 ZIP에서 완료된 항목
- Core50 모델 ID별 WebP 연결
- 이미지 50장 총량 약 254KB로 축소
- lazy loading, async decoding, 고정 크기, Netlify 장기 캐시
- `/admin/` 러닝화·대회·코스 CRUD 미리보기
- 공개/숨김, 검색, 백업/복원
- 기존 홈·검색·각 목록 페이지와 관리자 로컬 데이터 연동
- Supabase용 테이블/RLS 초안: `supabase/schema.sql`

## 실제 상용화 전에 반드시 남은 항목
1. Supabase 프로젝트 생성 및 URL/anon key 연결
2. 관리자 이메일 계정 생성 후 profiles.role='admin' 지정
3. Storage 버킷 생성과 업로드 정책 적용
4. 관리자 CRUD를 localStorage가 아니라 Supabase CRUD로 교체
5. 이미지 업로드 시 Edge Function 또는 이미지 CDN 변환 연결
6. 감사 로그, 복구, 예약 게시, CSV/ZIP 일괄 업로드 추가

현재 `/admin/`은 구조와 사용성을 바로 시험하는 1차판이며 같은 브라우저에서만 반영됩니다. 서버 계정 정보 없이 여러 기기와 모든 방문자에게 데이터를 영구 공유하는 관리자 시스템을 완성할 수는 없습니다.
