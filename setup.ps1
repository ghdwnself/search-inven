# 설치 및 실행 가이드

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "재고 조회 시스템 설치 시작" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# 1. 필수 파일 확인
Write-Host "`n[1/4] 필수 파일 확인 중..." -ForegroundColor Yellow

$requiredFiles = @(
    "server\credentials.json",
    ".env"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`n❌ 다음 파일이 누락되었습니다:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    Write-Host "`n자세한 내용은 README.md를 참조하세요." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 필수 파일 확인 완료" -ForegroundColor Green

# 2. 루트 의존성 설치
Write-Host "`n[2/4] 루트 패키지 설치 중..." -ForegroundColor Yellow
npm install

# 3. 서버 의존성 설치
Write-Host "`n[3/4] 서버 패키지 설치 중..." -ForegroundColor Yellow
Set-Location server
npm install
Set-Location ..

# 4. 클라이언트 의존성 설치
Write-Host "`n[4/4] 클라이언트 패키지 설치 중..." -ForegroundColor Yellow
Set-Location client
npm install
Set-Location ..

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "✅ 설치 완료!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan

Write-Host "`n다음 명령어로 서버를 실행하세요:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor Cyan

Write-Host "`n브라우저에서 다음 주소로 접속하세요:" -ForegroundColor Yellow
Write-Host "  http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
