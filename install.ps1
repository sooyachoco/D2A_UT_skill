<#
  D2A UT (사용성 테스트) Skill Bundle 설치기 (Windows / PowerShell)
  이 번들의 오버레이 파일을 d2a-boilerplate-claude 의 template/ 에 복사한다.

  사용법:
    pwsh ./install.ps1 -Target <d2a-boilerplate-claude 경로>
    예) pwsh ./install.ps1 -Target C:\work\d2a-boilerplate-claude

  신규 파일은 복사, 기존 파일은 .bak-<timestamp> 백업 후 덮어쓴다.
  CLAUDE.md 등록·dist 재빌드는 수동 단계로 안내한다.
#>
param([Parameter(Mandatory=$true)][string]$Target)
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path (Join-Path $Target "template")) {
  $Dest = Join-Path $Target "template"
} elseif ((Test-Path (Join-Path $Target "CLAUDE.md")) -and (Test-Path (Join-Path $Target ".claude"))) {
  $Dest = $Target
} else {
  Write-Error "'$Target' 에서 d2a-boilerplate-claude 구조(template/ 또는 CLAUDE.md+.claude/)를 찾지 못했습니다."
  exit 1
}
Write-Host "→ 설치 대상: $Dest"

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$overlay = @(
  ".claude/skills",
  ".claude/subagent-templates",
  "refs/ux-research",
  "frontend/tests/ut",
  "frontend/tests/tokens",
  "d2a-mcp-server/src/tools/task-validator.ts"
)

function Copy-One($rel) {
  $src = Join-Path $ScriptDir $rel
  $dst = Join-Path $Dest $rel
  if (Test-Path $src -PathType Container) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Get-ChildItem $src | ForEach-Object {
      $target = Join-Path $dst $_.Name
      if ($_.PSIsContainer) {
        # 중첩 디렉토리(예: real-ut-sessions/)는 재귀 복사 — 신규 디렉토리라 백업 불필요
        Copy-Item $_.FullName $target -Recurse -Force
        Write-Host "  ✓ $rel/$($_.Name)/ (디렉토리)"
      } else {
        if (Test-Path $target) { Copy-Item $target "$target.bak-$ts"; Write-Host "  ⤷ 백업: $rel/$($_.Name).bak-$ts" }
        Copy-Item $_.FullName $target -Force
        Write-Host "  ✓ $rel/$($_.Name)"
      }
    }
  } else {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
    if (Test-Path $dst) { Copy-Item $dst "$dst.bak-$ts"; Write-Host "  ⤷ 백업: $rel.bak-$ts" }
    Copy-Item $src $dst -Force
    Write-Host "  ✓ $rel"
  }
}

foreach ($item in $overlay) { Copy-One $item }

Write-Host ""
Write-Host "✅ 파일 복사 완료."

# task-validator.ts 를 덮어썼으므로 MCP 를 재빌드해 ut:/token: 게이트를 반영한다.
$McpDir = Join-Path $Dest "d2a-mcp-server"
Write-Host ""
Write-Host "→ MCP 재빌드 (ut:/token: 게이트 활성화)…"
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm -and (Test-Path (Join-Path $McpDir "package.json"))) {
  try {
    Push-Location $McpDir
    npm install --silent
    npm run build --silent
    Pop-Location
    $dist = Join-Path $McpDir "dist"
    $hasUt = Get-ChildItem -Recurse $dist -ErrorAction SilentlyContinue | Select-String -Quiet "checkUtReport"
    $hasToken = Get-ChildItem -Recurse $dist -ErrorAction SilentlyContinue | Select-String -Quiet "checkTokenReport"
    if ($hasUt -and $hasToken) {
      Write-Host "  ✓ MCP 빌드 완료 — ut:/token: 게이트 활성"
    } else {
      Write-Host "  ⚠️  빌드는 됐으나 dist 에 checkUtReport/checkTokenReport 미검출 — 수동 확인 필요"
    }
  } catch {
    Pop-Location -ErrorAction SilentlyContinue
    Write-Host "  ⚠️  MCP 빌드 실패 — 수동 실행: cd '$McpDir'; npm install; npm run build"
  }
} else {
  Write-Host "  ⚠️  npm 미설치 또는 d2a-mcp-server 부재 — 나중에 수동: cd '$McpDir'; npm install; npm run build"
}

# nxbasic-mcp 서버를 프로젝트 .mcp.json 에 등록(자동 실행 아님 — Claude Code 가 최초 사용 시 승인).
# 실패해도 오버레이 설치 자체는 막지 않는다(부가 기능).
Write-Host ""
Write-Host "→ nxbasic-mcp 등록 (DESIGN_SYSTEM=nxbasic 프로젝트용 — 컴포넌트/토큰 조회)…"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $mcpInstaller = Join-Path $ScriptDir "scripts/install-nxbasic-mcp.mjs"
  try {
    & node $mcpInstaller $Dest
    if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
  } catch {
    Write-Host "  ⚠️  nxbasic-mcp 등록 건너뜀 — 필요 시 수동: node scripts/install-nxbasic-mcp.mjs '$Dest'"
  }
} else {
  Write-Host "  ⚠️  node 미설치 — nxbasic-mcp 등록 건너뜀(수동 등록은 INTEGRATION.md 참조)"
}

Write-Host ""
Write-Host "남은 수동 2단계:"
Write-Host "[*] CLAUDE.md 스킬 표에 신규 5종 등록 + 스킬 수 표기 18개 → 23개"
Write-Host "      /ux-research-sync   외부 리서치 데이터를 refs/ux-research SSOT에 3단계 신뢰도로 적재"
Write-Host "      /ai-usability-test  Playwright 3 페르소나 자동 사용성 테스트 → UT_FINDINGS_REPORT.md"
Write-Host "      /real-ut-intake     실 사용자 UT 세션 원본을 AI 관측 스키마로 정규화"
Write-Host "      /design-handoff     UT 통과(S4=0) 후 개발 핸드오프 스펙 생성 (HANDOFF.md)"
Write-Host "      /token-conformance  디자인 토큰(색상·타이포) 준수 정적 분석 게이트 → TOKEN_CONFORMANCE_REPORT.md"
Write-Host "    (create-spec·pre-launch-check 은 기존 엔진 스킬 상위호환 덮어쓰기 — 신규 등록 아님)"
Write-Host ""
Write-Host "[*] token-conformance 도입 시 baseline 동결 1회 필수:"
Write-Host "      node frontend/tests/tokens/token-conformance.mjs --update-baseline"
Write-Host "      (안 하면 기존 하드코딩이 전부 신규 위반으로 잡혀 게이트가 막힌다)"
Write-Host ""
Write-Host "자세한 병합 판정·매핑은 INTEGRATION.md 참조."
