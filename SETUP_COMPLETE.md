# 프로젝트 완성 안내

## ✅ 생성된 파일 구조

```
inven/
│
├── 📄 package.json              # 루트 패키지 (통합 실행 스크립트)
├── 📄 .env                      # 환경 변수 (Sheet ID, Folder ID 입력 필요)
├── 📄 .env.example              # 환경 변수 예시
├── 📄 .gitignore                # Git 제외 파일
├── 📄 README.md                 # 프로젝트 문서
├── 📄 CHECKLIST.md              # 시작 전 체크리스트
├── 📄 setup.ps1                 # 자동 설치 스크립트
│
├── 📁 server/                   # 백엔드 (Express)
│   ├── 📄 package.json
│   ├── 📄 index.js              # 메인 서버 파일
│   └── 🔐 credentials.json      # ⚠️ 직접 추가 필요!
│
└── 📁 client/                   # 프론트엔드 (React + Vite)
    ├── 📄 package.json
    ├── 📄 vite.config.js        # Vite 설정 (프록시 포함)
    ├── 📄 tailwind.config.js    # Tailwind CSS 설정
    ├── 📄 postcss.config.js
    ├── 📄 index.html
    │
    ├── 📁 public/
    │   ├── 📄 README.md
    │   └── 🖼️ nf_logo.png        # ⚠️ 직접 추가 권장!
    │
    └── 📁 src/
        ├── 📄 main.jsx          # React 엔트리 포인트
        ├── 📄 App.jsx           # 메인 앱 컴포넌트
        ├── 📄 index.css         # 커스텀 CSS (Inter 폰트, 색상 테마)
        │
        └── 📁 components/
            ├── 📄 Sidebar.jsx         # 사이드바 (메뉴)
            ├── 📄 SearchView.jsx      # 재고 조회 화면
            ├── 📄 BulkSearchView.jsx  # 다중 검색 화면
            └── 📄 ProductCard.jsx     # 제품 카드 컴포넌트
```

## 🚀 다음 단계

### 1. 필수 파일 추가

#### server/credentials.json
1. Google Cloud Console에서 서비스 계정 JSON 키 다운로드
2. `server/credentials.json` 경로에 저장

#### .env 파일 설정
`.env` 파일을 열고 실제 값으로 수정:
```env
GOOGLE_SHEET_ID=실제_시트_ID
GOOGLE_DRIVE_FOLDER_ID=실제_폴더_ID
```

#### client/public/nf_logo.png (선택)
- 회사 로고 이미지를 이 경로에 저장
- 없으면 기본 텍스트로 표시됨

### 2. 설치 및 실행

PowerShell에서 프로젝트 루트로 이동 후:

```powershell
# 방법 1: 자동 설치 스크립트
.\setup.ps1

# 방법 2: 수동 설치
npm run install-all

# 실행
npm run dev
```

### 3. 브라우저 접속
```
http://localhost:3000
```

## 🎯 구현된 기능

### 백엔드 (server/)
✅ Google Sheets API 연동 (credentials.json 사용)
✅ Google Drive API 연동 (이미지 매핑)
✅ 메모리 캐싱 (서버 시작 시 데이터 로드)
✅ API 엔드포인트:
   - GET /api/brands - 브랜드 목록
   - GET /api/products - 제품 검색 (q, brand, category 필터)
   - POST /api/products/bulk - 다중 SKU 조회
   - GET /api/health - 서버 상태 확인

### 프론트엔드 (client/)
✅ React 18 + Vite
✅ Tailwind CSS + 커스텀 CSS
✅ Inter 폰트 적용
✅ 색상 테마 (#C70039 Primary, #F8FAFC Background)
✅ 반응형 디자인
✅ 컴포넌트:
   - 사이드바 (로고 + 메뉴)
   - 재고 조회 (브랜드 필터 + 검색)
   - 제품 카드 (이미지 + 정보)
   - 다중 검색 (엑셀 복사/붙여넣기)

## 📋 데이터 형식 요구사항

### Google Sheets (item_master)
필수 헤더:
- SKU
- Brand
- ProductName_Short
- Category
- Sub_Category

선택 헤더:
- Stock
- Price

### Google Drive 이미지
파일명 = SKU (예: `ABC123.jpg`)

## 🛠️ 기술 스택

**백엔드:**
- Express.js
- google-spreadsheet ^4.1.2
- googleapis ^128.0.0
- cors, dotenv

**프론트엔드:**
- React 18
- Vite 5
- Tailwind CSS 3
- Axios
- Inter Font (Google Fonts)

**모노레포:**
- Concurrently (동시 실행)
- Workspaces

## 📞 문제 해결

문제가 발생하면 `CHECKLIST.md`를 확인하세요.

서버 콘솔에서 다음 메시지를 확인:
```
✅ X개의 이미지 파일 발견
✅ X개의 제품 데이터 준비 완료
🚀 서버가 http://localhost:5000 에서 실행 중입니다.
```

## 🎉 완료!

모든 설정이 완료되면 바로 사용할 수 있습니다!
