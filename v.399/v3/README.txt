RunningFit V3 Update #001

교체/추가할 파일 위치:

1) script.js
   - 프로젝트 루트의 기존 script.js와 교체

2) assets/ai-shoe-images.js
   - assets 폴더 안에 넣기

3) database/nike/shoes-nike-batch-01.json
   - database/nike 폴더 안에 넣기

4) index.html, shoes.html
   - 이미 ai-shoe-images.js 연결이 들어간 버전입니다. 필요하면 교체하세요.

5) data/shoes.json
   - 기존 데이터 백업용으로 포함했습니다. 이미 프로젝트에 있으면 꼭 교체하지 않아도 됩니다.

적용 후 확인:
- VS Code에서 Ctrl+S
- 브라우저에서 http://127.0.0.1:5500/shoes.html 열기
- Ctrl+F5 강력 새로고침

적용 내용:
- Nike 공식 검증 배치 파일 자동 병합
- 공식 이미지가 있으면 공식 이미지 표시
- 공식 이미지가 없으면 AI 생성 대표 이미지 표시
- 카드에 AI 생성 대표 이미지 배지 표시
