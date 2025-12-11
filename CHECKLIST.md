# 시작 전 체크리스트 ✓

프로젝트를 실행하기 전에 다음 항목을 확인하세요:

## 1. Google Cloud 설정

### Google Cloud Console
- [ ] Google Cloud 프로젝트 생성됨
- [ ] Google Sheets API 활성화됨
- [ ] Google Drive API 활성화됨

### 서비스 계정
- [ ] 서비스 계정 생성됨
- [ ] JSON 키 파일 다운로드됨
- [ ] `server/credentials.json` 경로에 파일 저장됨

### 권한 설정
- [ ] Google Sheets에 서비스 계정 이메일 공유됨 (읽기 권한)
- [ ] Google Drive 폴더에 서비스 계정 이메일 공유됨 (읽기 권한)

## 2. 환경 설정

### .env 파일
- [ ] `.env` 파일이 루트 디렉토리에 존재함
- [ ] `GOOGLE_SHEET_ID` 값이 실제 Sheet ID로 설정됨
- [ ] `GOOGLE_DRIVE_FOLDER_ID` 값이 실제 Folder ID로 설정됨

### Google Sheets 구조
- [ ] `item_master` 시트가 존재함
- [ ] 다음 헤더가 포함됨:
  - [ ] SKU
  - [ ] Brand
  - [ ] ProductName_Short
  - [ ] Category
  - [ ] Sub_Category
  - [ ] Stock (선택)
  - [ ] Price (선택)

### Google Drive 이미지
- [ ] 이미지가 지정된 폴더에 업로드됨
- [ ] 파일명이 SKU와 일치함 (예: `ABC123.jpg`)

## 3. 프로젝트 파일

### 필수 파일
- [ ] `server/credentials.json` 존재
- [ ] `.env` 파일 존재 및 설정 완료
- [ ] `client/public/nf_logo.png` 존재 (선택사항)

## 4. 설치 및 실행

### 설치
```powershell
# 방법 1: 자동 설치 스크립트 실행
.\setup.ps1

# 방법 2: 수동 설치
npm run install-all
```

### 실행
```powershell
npm run dev
```

### 확인사항
- [ ] 서버가 http://localhost:5000에서 실행됨
- [ ] 클라이언트가 http://localhost:3000에서 실행됨
- [ ] 브라우저에서 http://localhost:3000 접속 가능
- [ ] 서버 콘솔에 다음 메시지가 표시됨:
  - ✅ X개의 이미지 파일 발견
  - ✅ X개의 제품 데이터 준비 완료

## 문제 해결

### 서버가 시작되지 않음
1. `server/credentials.json` 파일이 올바른 JSON 형식인지 확인
2. `.env` 파일의 ID 값들이 정확한지 확인
3. Node.js가 설치되어 있는지 확인 (`node -v`)

### 데이터가 로드되지 않음
1. Google Sheets API가 활성화되어 있는지 확인
2. 서비스 계정에 Sheet 접근 권한이 있는지 확인
3. Sheet ID가 정확한지 확인

### 이미지가 표시되지 않음
1. Google Drive API가 활성화되어 있는지 확인
2. 서비스 계정에 Drive 폴더 접근 권한이 있는지 확인
3. 파일명이 SKU와 정확히 일치하는지 확인

---

모든 항목을 체크했다면 `npm run dev`를 실행하세요! 🚀
