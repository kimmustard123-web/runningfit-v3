RunningFit Supabase 1단계 패치

교체 파일:
- api/shoes.js
- js/shoes.js
- js/home.js
- shoes.html
- index.html

기능:
- Vercel /api/shoes가 환경변수로 Supabase shoes 테이블 조회
- 러닝화 페이지와 홈이 Supabase 데이터 사용
- API 오류/빈 데이터 시 data/shoes.json 자동 복구
- 기존 검색, 추천, TOP 순위 기능 유지

배포:
1. 이 압축 내용을 기존 프로젝트 루트에 덮어쓰기
2. Source Control -> Stage All -> Commit
3. Sync Changes/Push
4. Vercel 새 배포 Ready 확인
5. https://runningfit-v3.vercel.app/api/shoes 접속
   source: supabase, count: 50 이면 성공
