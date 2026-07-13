#!/usr/bin/env bash
# D2A UT (사용성 테스트) Skill Bundle 설치기
# 이 번들의 오버레이 파일을 d2a-boilerplate-claude 의 template/ 에 복사한다.
#
# 사용법:
#   bash install.sh <d2a-boilerplate-claude 경로>
#   예) bash install.sh ~/work/d2a-boilerplate-claude
#
# 동작: 신규 파일은 복사, 기존 파일(create-spec.md/pre-launch-check.md/accessibility.md/
# task-validator.ts)은 .bak-<timestamp> 백업 후 덮어쓴다. CLAUDE.md 등록·dist 재빌드는
# 수동 단계로 안내한다(자동 편집하지 않음).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "❌ 사용법: bash install.sh <d2a-boilerplate-claude 경로>"
  exit 1
fi

# template/ 위치 결정: 본체 루트면 template/, 이미 template/ 를 가리키면 그대로.
if [ -d "$TARGET/template" ]; then
  DEST="$TARGET/template"
elif [ -f "$TARGET/CLAUDE.md" ] && [ -d "$TARGET/.claude" ]; then
  DEST="$TARGET"
else
  echo "❌ '$TARGET' 에서 d2a-boilerplate-claude 구조(template/ 또는 CLAUDE.md+.claude/)를 찾지 못했습니다."
  exit 1
fi
echo "→ 설치 대상: $DEST"

TS="$(date +%Y%m%d-%H%M%S)"
OVERLAY=(
  ".claude/skills"
  ".claude/subagent-templates"
  "refs/ux-research"
  "frontend/tests/ut"
  "frontend/tests/tokens"
  "d2a-mcp-server/src/tools/task-validator.ts"
)

copy_one() {
  local rel="$1" src="$SCRIPT_DIR/$1" dst="$DEST/$1"
  if [ -d "$src" ]; then
    mkdir -p "$dst"
    for f in "$src"/*; do
      local name; name="$(basename "$f")"
      if [ -d "$f" ]; then
        # 중첩 디렉토리(예: real-ut-sessions/)는 재귀 복사 — 신규 디렉토리라 백업 불필요
        cp -rp "$f" "$dst/$name"
        echo "  ✓ $rel/$name/ (디렉토리)"
      else
        [ -e "$dst/$name" ] && cp -p "$dst/$name" "$dst/$name.bak-$TS" && echo "  ⤷ 백업: $rel/$name.bak-$TS"
        cp -p "$f" "$dst/$name"
        echo "  ✓ $rel/$name"
      fi
    done
  else
    mkdir -p "$(dirname "$dst")"
    [ -e "$dst" ] && cp -p "$dst" "$dst.bak-$TS" && echo "  ⤷ 백업: $rel.bak-$TS"
    cp -p "$src" "$dst"
    echo "  ✓ $rel"
  fi
}

for item in "${OVERLAY[@]}"; do copy_one "$item"; done

echo ""
echo "✅ 파일 복사 완료."

# task-validator.ts 를 덮어썼으므로 MCP 를 재빌드해 ut:/token: 게이트를 반영한다.
# (보일러플레이트의 dist/ 는 구버전이라 자동 재빌드가 필수다.)
MCP_DIR="$DEST/d2a-mcp-server"
echo ""
echo "→ MCP 재빌드 (ut:/token: 게이트 활성화)…"
if command -v npm >/dev/null 2>&1 && [ -f "$MCP_DIR/package.json" ]; then
  if ( cd "$MCP_DIR" && npm install --silent && npm run build --silent ); then
    if grep -rlq "checkUtReport" "$MCP_DIR/dist" 2>/dev/null && grep -rlq "checkTokenReport" "$MCP_DIR/dist" 2>/dev/null; then
      echo "  ✓ MCP 빌드 완료 — ut:/token: 게이트 활성"
    else
      echo "  ⚠️  빌드는 됐으나 dist 에 checkUtReport/checkTokenReport 미검출 — 수동 확인 필요"
    fi
  else
    echo "  ⚠️  MCP 빌드 실패 — 수동 실행: (cd \"$MCP_DIR\" && npm install && npm run build)"
  fi
else
  echo "  ⚠️  npm 미설치 또는 d2a-mcp-server 부재 — 나중에 수동 빌드:"
  echo "      (cd \"$MCP_DIR\" && npm install && npm run build)"
fi

cat <<'EOF'

남은 수동 2단계:
[*] CLAUDE.md 스킬 표에 신규 5종 등록 (미등록 시 자동 호출 안 됨) + 스킬 수 표기 18개 → 23개
    | `/ux-research-sync`   | 외부 리서치 데이터를 refs/ux-research SSOT에 3단계 신뢰도로 적재 |
    | `/ai-usability-test`  | Playwright 3 페르소나 자동 사용성 테스트 → UT_FINDINGS_REPORT.md |
    | `/real-ut-intake`     | 실 사용자 UT 세션 원본을 AI 관측 스키마로 정규화 |
    | `/design-handoff`     | UT 통과(S4=0) 후 개발 핸드오프 스펙 생성 (design:design-handoff 호출, HANDOFF.md) |
    | `/token-conformance`  | 디자인 토큰(색상·타이포) 준수 정적 분석 게이트 → TOKEN_CONFORMANCE_REPORT.md |

[*] token-conformance 도입 시 baseline 동결 1회 필수:
    node frontend/tests/tokens/token-conformance.mjs --update-baseline
    (안 하면 기존 하드코딩이 전부 신규 위반으로 잡혀 게이트가 막힌다)

(create-spec·pre-launch-check 은 기존 엔진 스킬을 상위호환으로 덮어쓴 것이라 신규 등록 대상이 아니다.)
자세한 병합 판정·매핑은 INTEGRATION.md 참조.
EOF
