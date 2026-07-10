# RunningFit Commercial Phase 3

## 적용 내용
- 공용 JSON 메모리 캐시 추가: 같은 페이지에서 같은 JSON 중복 요청 방지
- 검색 입력 디바운스 적용: 타이핑마다 전체 필터링하는 부담 감소
- 러닝화 카드 24개 단위 점진 렌더링
- 화면 밖 카드에 `content-visibility` 적용
- shoes.js의 중복 햄버거/테마 이벤트 제거
- 기존 `defer` 스크립트 로딩 유지
- Netlify 정적 자산 캐시 보완

## 확인 사항
현재 프로젝트에는 실제 러닝화 이미지 파일이 포함되어 있지 않으므로 WebP/AVIF 변환 대상은 없습니다. 향후 이미지를 추가할 때는 assets/images 아래에 WebP 또는 AVIF로 넣고 width/height, loading=lazy를 적용해야 합니다.


## 상용화 4단계
- 햄버거 메뉴 배경 블러 제거
- localStorage 직접 호출을 RFBackend 저장 계층으로 분리
- 프로필/내 신발/러닝 기록의 서버 전환 준비
- Supabase 초기 스키마 및 RLS 정책 초안 추가
- 실제 서버 로그인은 Supabase 프로젝트 URL과 키를 연결한 뒤 활성화해야 함


## 로컬/Netlify 동기화 패치
- 배포 버전: `20260711-sync1`
- 모든 CSS/JS URL에 버전 쿼리 적용
- 개발 중 CSS/JS/JSON 캐시 재검증 적용
- `deploy-version.json` 추가
- Netlify에는 이 폴더의 내용 전체를 배포해야 함
