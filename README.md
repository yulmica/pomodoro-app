# 뽀모도로 웹앱 배포하기

## 방법 A — 가장 쉬움 (StackBlitz, 설치 필요 없음)
1. 컴퓨터에서 https://stackblitz.com 접속 → "Create" → "Vite" → "React" 선택
2. 왼쪽 파일 목록에서 `src/App.jsx` 내용을 지우고, 이 폴더의 `src/App.jsx` 내용을 복사해서 붙여넣기
3. `package.json`의 dependencies에 `lucide-react`, `recharts` 추가 (이 폴더의 package.json 참고) → StackBlitz가 자동으로 설치함
4. 오른쪽 미리보기에 앱이 뜨면 성공. 상단의 "Deploy" 버튼을 누르면 실제 도메인(예: `xxx.stackblitz.io` 또는 Netlify 연결)으로 배포됨
5. 그 배포 주소를 휴대폰 브라우저로 열기

## 방법 B — 컴퓨터에 Node.js 설치되어 있는 경우
1. 이 폴더를 통째로 다운로드
2. 터미널에서 폴더로 이동 후:
   ```
   npm install
   npm run build
   ```
3. `dist` 폴더가 생성됨 → https://app.netlify.com/drop 에 `dist` 폴더를 드래그 앤 드롭
4. 몇 초 후 실제 URL이 발급됨 (예: `https://random-name.netlify.app`)

## 휴대폰에 앱처럼 설치하기
1. 배포된 주소를 휴대폰 브라우저(Chrome/Safari)로 열기
2. 브라우저 메뉴 → "홈 화면에 추가" (iOS: 공유 버튼 → 홈 화면에 추가)
3. 홈 화면에 아이콘이 생기고, 눌러서 열면 주소창 없이 앱처럼 열림

## 참고
- 데이터는 이제 브라우저의 localStorage에 저장돼요 (이 사이트를 여는 그 브라우저/기기에만 저장됨).
- 설정 > 백업의 "내보내기"로 주기적으로 JSON 파일을 저장해두면 기기를 바꾸거나 브라우저 데이터를 지워도 복원할 수 있어요.
