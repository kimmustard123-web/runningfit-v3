# RunningFit V5 관리자 사용법

## 접속
- 로컬: `http://127.0.0.1:5500/admin/`
- 배포 후: `https://도메인/admin/`

## 현재 바로 되는 기능
- 로컬 관리자 진입
- 러닝화·대회·코스 추가/수정/공개/숨김/삭제
- 검색 및 공개 상태 필터
- 전체 JSON 백업/복원
- PNG/JPG를 WebP로 축소하고 다운로드
- 관리자 수정 데이터가 같은 브라우저의 기존 페이지에 반영

## 상용화 전 반드시 할 일
1. Supabase 프로젝트 생성
2. `supabase/schema.sql` 실행
3. Storage bucket `runningfit-media` 생성
4. `js/backend-config.js`에 Project URL과 anon key 입력
5. 관리자 계정의 `profiles.role`을 `admin`으로 지정
6. 관리자 CRUD와 이미지 업로드를 Supabase API로 전환

현재 로컬 모드는 개발·검수용이며 다른 사용자에게 공통 반영되지 않습니다.
