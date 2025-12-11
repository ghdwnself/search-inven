# 방화벽 규칙 추가 스크립트
# 관리자 권한으로 실행 필요

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "방화벽 규칙 추가" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# 포트 3000 (프론트엔드)
Write-Host "`n[1/2] 포트 3000 규칙 추가 중..." -ForegroundColor Yellow
New-NetFirewallRule `
    -DisplayName "재고조회시스템-Frontend" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -ErrorAction SilentlyContinue

# 포트 5000 (백엔드)
Write-Host "`n[2/2] 포트 5000 규칙 추가 중..." -ForegroundColor Yellow
New-NetFirewallRule `
    -DisplayName "재고조회시스템-Backend" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 5000 `
    -Action Allow `
    -ErrorAction SilentlyContinue

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "✅ 방화벽 규칙 추가 완료!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan

Write-Host "`n이제 다른 PC에서 접속할 수 있습니다." -ForegroundColor Cyan
