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
  "d2a-mcp-server/src/tools/task-validator.ts"
)

function Copy-One($rel) {
  $src = Join-Path $ScriptDir $rel
  $dst = Join-Path $Dest $rel
  if (Test-Path $src -PathType Container) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Get-ChildItem -File $src | ForEach-Object {
      $target = Join-Path $dst $_.Name
      if (Test-Path $target) { Copy-Item $target "$target.bak-$ts"; Write-Host "  ⤷ 백업: $rel/$($_.Name).bak-$ts" }
      Copy-Item $_.FullName $target -Force
      Write-Host "  ✓ $rel/$($_.Name)"
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

# task-validator.ts 를 덮어썼으므로 MCP 를 재빌드해 ut: 게이트를 반영한다.
$McpDir = Join-Path $Dest "d2a-mcp-server"
Write-Host ""
Write-Host "→ MCP 재빌드 (ut: 게이트 활성화)…"
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm -and (Test-Path (Join-Path $McpDir "package.json"))) {
  try {
    Push-Location $McpDir
    npm install --silent
    npm run build --silent
    Pop-Location
    if (Get-ChildItem -Recurse (Join-Path $McpDir "dist") -ErrorAction SilentlyContinue | Select-String -Quiet "checkUtReport") {
      Write-Host "  ✓ MCP 빌드 완료 — ut: 게이트 활성"
    } else {
      Write-Host "  ⚠️  빌드는 됐으나 dist 에 checkUtReport 미검출 — 수동 확인 필요"
    }
  } catch {
    Pop-Location -ErrorAction SilentlyContinue
    Write-Host "  ⚠️  MCP 빌드 실패 — 수동 실행: cd '$McpDir'; npm install; npm run build"
  }
} else {
  Write-Host "  ⚠️  npm 미설치 또는 d2a-mcp-server 부재 — 나중에 수동: cd '$McpDir'; npm install; npm run build"
}

Write-Host ""
Write-Host "남은 수동 1단계:"
Write-Host "[*] CLAUDE.md 스킬 표에 신규 3종 등록 + 스킬 수 표기 18개 → 21개"
Write-Host "      /ux-research-sync   외부 리서치 데이터를 refs/ux-research SSOT에 3단계 신뢰도로 적재"
Write-Host "      /ai-usability-test  Playwright 3 페르소나 자동 사용성 테스트 → UT_FINDINGS_REPORT.md"
Write-Host "      /design-handoff     UT 통과(S4=0) 후 개발 핸드오프 스펙 생성 (HANDOFF.md)"
Write-Host "    (create-spec·pre-launch-check 은 기존 엔진 스킬 상위호환 덮어쓰기 — 신규 등록 아님)"
Write-Host ""
Write-Host "자세한 병합 판정·매핑은 INTEGRATION.md 참조."
