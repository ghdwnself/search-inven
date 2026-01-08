# 이미지 기반 재고 조회 시스템

Google Sheets와 Google Drive를 연동한 재고 조회 시스템입니다.

## 📁 프로젝트 구조

```
inven/
├── server/              # 백엔드 (Express)
│   ├── index.js
│   ├── package.json
│   └── credentials.json # Google API 인증 파일 (직접 추가 필요)
├── client/              # 프론트엔드 (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── SearchView.jsx
│   │   │   ├── BulkSearchView.jsx
│   │   │   ├── AdminView.jsx
│   │   │   └── ProductCard.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   │   └── nf_logo.png  # 로고 파일 (선택사항)
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── data/                # 데이터 파일 (템플릿)
│   └── products_template.csv
├── .env                 # 환경 변수 설정 (직접 설정 필요)
├── .gitignore
├── CHECKLIST.md         # 시작 전 체크리스트
├── 사용가이드.md         # 사용자 가이드
├── setup.ps1            # 자동 설치 스크립트
├── setup-firewall.ps1   # 방화벽 설정 스크립트
└── package.json         # 루트 패키지 (통합 실행 스크립트)
```

## 🚀 시작하기

### 1. 필수 준비사항

#### Google Cloud 설정
1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. **Google Sheets API** 및 **Google Drive API** 활성화
3. 서비스 계정 생성:
   - IAM 및 관리자 > 서비스 계정 > 서비스 계정 만들기
   - 서비스 계정 생성 후 키 추가 (JSON 형식)
   - 다운로드한 JSON 파일을 `server/credentials.json`으로 저장
4. Google Sheets와 Drive 폴더에 서비스 계정 이메일 공유 권한 부여

#### 환경 변수 설정
루트 디렉토리의 `.env` 파일을 열고 다음 값을 입력하세요:

```env
GOOGLE_SHEET_ID=your_actual_sheet_id_here
GOOGLE_DRIVE_FOLDER_ID=your_actual_folder_id_here
```

- **GOOGLE_SHEET_ID**: Google Sheets URL에서 확인
  - `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
- **GOOGLE_DRIVE_FOLDER_ID**: Google Drive 폴더 URL에서 확인
  - `https://drive.google.com/drive/folders/{FOLDER_ID}`

#### 로고 파일 추가
`client/public/nf_logo.png` 경로에 로고 이미지를 추가하세요.

### 2. 설치 및 실행

```powershell
# 모든 의존성 설치
npm run install-all

# 개발 서버 실행 (백엔드 + 프론트엔드 동시 실행)
npm run dev
```

서버가 시작되면:
- 백엔드: `http://localhost:5000`
- 프론트엔드: `http://localhost:3000`

브라우저에서 `http://localhost:3000`을 열어 애플리케이션을 사용하세요.

## 📊 Google Sheets 데이터 형식

`item_master` 시트는 다음 헤더를 포함해야 합니다:

| SKU | Brand | ProductName_Short | Category | Sub_Category | Stock | Price |
|-----|-------|-------------------|----------|--------------|-------|-------|
| ... | ...   | ...               | ...      | ...          | ...   | ...   |

- **필수 열**: SKU, Brand, ProductName_Short, Category, Sub_Category
- **선택 열**: Stock, Price (있으면 표시됨)

## 🖼️ Google Drive 이미지 매핑

Google Drive 폴더의 이미지 파일명은 **SKU와 일치**해야 합니다.

예시:
- SKU: `ABC123` → 파일명: `ABC123.jpg`, `ABC123.png` 등

## 🎨 주요 기능

### 1. 재고 조회
- 브랜드별 필터링
- 제품명/SKU 검색
- 이미지 포함 카드 형식으로 결과 표시

### 2. 다중 SKU 검색
- 엑셀에서 복사한 SKU 목록을 붙여넣기
- 여러 제품을 한 번에 조회
- 테이블 형식으로 결과 표시

## 🛠️ API 엔드포인트

- `GET /api/brands` - 브랜드 목록 조회
- `GET /api/products?q={검색어}&brand={브랜드}` - 제품 검색
- `POST /api/products/bulk` - 다중 SKU 조회
  ```json
  {
    "skus": ["SKU1", "SKU2", "SKU3"]
  }
  ```
- `GET /api/health` - 서버 상태 확인

## 🎨 스타일링

- **색상 테마**:
  - Primary: `#C70039` (빨강)
  - Background: `#F8FAFC` (연한 회색)
  - Sidebar: `#1e293b` (진한 회색)
- **폰트**: Inter (Google Fonts)
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

## 📝 개별 실행 스크립트

```powershell
# 백엔드만 실행
npm run server

# 프론트엔드만 실행
npm run client
```

## ⚠️ 문제 해결

### 인증 오류
- `server/credentials.json` 파일이 올바른 위치에 있는지 확인
- 서비스 계정에 Sheets 및 Drive 접근 권한이 있는지 확인

### 데이터가 로드되지 않음
- `.env` 파일의 SHEET_ID와 FOLDER_ID가 정확한지 확인
- 서버 콘솔에서 에러 메시지 확인

### 이미지가 표시되지 않음
- Drive 폴더의 파일명이 SKU와 일치하는지 확인
- 서비스 계정이 Drive 폴더에 대한 읽기 권한을 가지고 있는지 확인

## 📦 기술 스택

### 백엔드
- Express.js
- google-spreadsheet
- googleapis
- cors, dotenv

### 프론트엔드
- React 18
- Vite
- Axios
- Tailwind CSS

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.
