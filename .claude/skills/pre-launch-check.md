---
name: pre-launch-check
description: 서비스 배포 전 체크리스트를 프로젝트 유형별로 검증. 배포 전 체크, 오픈 준비, 런치 체크리스트 요청 시 사용.
---

# Pre-Launch Check

서비스 배포 전에 프로젝트 유형에 맞는 체크리스트를 실행한다.

## Step 1: 프로젝트 유형 확인

```
🔶 프로젝트 유형을 확인합니다.

이 프로젝트는 어떤 유형인가요?

A) 사내 도구 (사내망, 직원 전용)
B) 유저용 서비스 (인터넷 공개, 외부 사용자)
```

## Step 2-A: 사내 도구 체크리스트

| # | 항목 | 필수 | 상태 |
|---|---|---|---|
| 1 | 소스코드 보안 진단 통과 | ☑ 필수 | ⬜ |
| 2 | QA 테스트 | ☐ 선택 | ⬜ |
| 3 | 접근성 검수 | ☐ 권장 | ⬜ |
| 4 | 운영 이관 문서 (README) | ☐ 필수 | ⬜ |
| 5 | 디자인 토큰 준수 (DESIGN_SYSTEM=nxbasic 인 경우만) | ☐ 조건부 필수 | ⬜ |

> **접근성 검수 처리 방침 (사내 도구)**:
> `specs/{NNN}/ut/UT_FINDINGS_REPORT.md`의 "기술적 접근성 이슈" 섹션이 존재하면 그 결과로 갈음한다.
> 파일이 없으면 `ai-usability-test 실행해줘`로 먼저 자동 1차 필터링을 수행한다.

> **디자인 토큰 준수 처리 방침**: `state.json.design_system == "nxbasic"` 인 프로젝트만 해당한다(그 외엔 5번 항목 자체를 N/A 처리).
> Step 2.7.6에서 배선된 `token:` 게이트가 매 Phase review마다 이미 확인해왔으므로, 여기서는
> `specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md`의 `token_violations=0` 최종 확인만 하면 된다.
> 리포트가 없거나 오래됐으면(`node frontend/tests/tokens/token-conformance.mjs`) 재실행 후 확인한다.

## Step 2-B: 유저용 서비스 체크리스트

| # | 항목 | 필수 | 상태 |
|---|---|---|---|
| 1 | 종합 보안 진단 (소스코드+모의해킹+인프라) | ☑ 필수 | ⬜ |
| 2 | QA 테스트 (시나리오 50개+) | ☑ 필수 | ⬜ |
| 3 | 성능/부하 테스트 (예상 트래픽 2배) | ☑ 필수 | ⬜ |
| 4 | 법무 검토 (이용약관, 개인정보처리방침) | ☑ 필수 | ⬜ |
| 5 | 접근성 검수 (WCAG AA) | ☑ 필수 | ⬜ |
| 6 | 운영 이관 문서 (가이드+장애대응 매뉴얼) | ☑ 필수 | ⬜ |
| 7 | 디자인 토큰 준수 (DESIGN_SYSTEM=nxbasic 인 경우만) | ☑ 조건부 필수 | ⬜ |

> **접근성 검수 처리 방침 (유저용 서비스)**:
> 1단계 — `specs/{NNN}/ut/UT_FINDINGS_REPORT.md` 확인: "기술적 접근성 이슈" 섹션이 있으면
>   S4/S3 항목이 0건인지 확인 후 다음 단계 진행.
> 2단계 — S4/S3 접근성 이슈가 있거나 UT 결과 파일이 없으면 `design:accessibility-review`로
>   심층 리뷰를 수행한다.
> → 자동화(`ai-usability-test`)가 1차 필터, `design:accessibility-review`가 2차 심층 검토.

> **디자인 토큰 준수 처리 방침**: `state.json.design_system == "nxbasic"` 인 프로젝트만 해당한다(그 외엔 7번 항목 N/A).
> Step 2.7.6에서 배선된 `token:` 게이트가 매 Phase review마다 이미 확인해왔으므로, 여기서는
> `specs/{NNN}/tokens/TOKEN_CONFORMANCE_REPORT.md`의 `token_violations=0` 최종 확인만 하면 된다.

추가 확인:
- WAF + DDoS 방어 설정
- 개인정보영향평가 완료
- 암호화 적용 (전 구간 TLS, DB/S3 암호화)
- 로그 보관 정책 설정 (1년)
- 모니터링 알림 설정 (Datadog/Sentry)

## Step 2-C: tasks.md Phase 7 생성 (배포 전 체크리스트를 추적 가능한 태스크로 전환)

> **핵심 원칙**: 수동 체크리스트는 PROGRESS.md 자유 텍스트로 남기지 않고,
> tasks.md Phase 7에 done 기준이 있는 태스크로 등록한다.
> 이를 통해 MCP 하네스가 완료 여부를 추적하고 배포 게이트 역할을 수행한다.

tasks.md를 읽어 Phase 7이 없으면 아래 Phase 7 블록을 tasks.md 맨 끝에 추가한다.
이미 Phase 7이 있으면 이 Step을 건너뛴다.

프로젝트 유형에 따라 두 가지 템플릿 중 하나를 선택한다:

**[사내 도구 — Phase 7 템플릿]**
```markdown
---

## Phase 7: 배포 전 체크리스트

### T701: 커버리지 게이트 검증
**read**: -
**write**: -
**done**:
  - cmd: cd backend && pytest --cov=app --cov-report=json -q
  - coverage: backend/app :: 75
**deps**: T{마지막Phase}-review
**status**: ☐

### T702: 소스코드 보안 진단 의뢰 확인
**read**: -
**write**: -
**done**:
  - contains: PROGRESS.md :: 보안 진단 완료
**deps**: T701
**status**: ☐

### T703: 운영 이관 문서 완비 (README + RUNBOOK)
**read**: -
**write**: -
**done**:
  - file: README.md
  - file: RUNBOOK.md
**deps**: T701
**status**: ☐
```

**[유저용 서비스 — Phase 7 템플릿]**
```markdown
---

## Phase 7: 배포 전 체크리스트

### T701: 커버리지 게이트 검증
**read**: -
**write**: -
**done**:
  - cmd: cd backend && pytest --cov=app --cov-report=json -q
  - coverage: backend/app :: 75
**deps**: T{마지막Phase}-review
**status**: ☐

### T702: 빌드 최종 검증
**read**: -
**write**: -
**done**:
  - cmd: cd backend && pytest -q
  - cmd: cd frontend && npm run build
**deps**: T701
**status**: ☐

### T703: 운영 이관 문서 완비 (README + RUNBOOK)
**read**: -
**write**: -
**done**:
  - file: README.md
  - file: RUNBOOK.md
**deps**: T701
**status**: ☐

### T704: 보안 진단 의뢰 + QA 완료 확인
**read**: -
**write**: -
**done**:
  - contains: PROGRESS.md :: 보안 진단 완료
  - contains: PROGRESS.md :: QA 완료
**deps**: T703
**status**: ☐

### T705: 프로덕션 환경변수 및 도메인 설정 확인
**read**: -
**write**: -
**done**:
  - cmd: bash scripts/check-env.sh
**deps**: T703
**status**: ☐
```

Phase 7 생성 후 PROGRESS.md의 수동 체크리스트 항목을 위 태스크로 대체했음을 기록한다.

## Step 2-D: 반복 버그 패턴 체크리스트 (자동 확인)

> QA에서 반복 발견되는 패턴을 배포 전에 자동 점검한다.
> 각 항목은 해당 파일 패턴이 존재하는 경우에만 실행한다.

### 로컬 개발 환경

```bash
# BACKEND_URL self-proxy 위험 감지 (next.config.ts가 있는 경우)
if [ -f next.config.ts ] || [ -f next.config.js ]; then
  if grep -q "BACKEND_URL.*localhost:3000\|?? .*localhost:3000" next.config.ts next.config.js 2>/dev/null; then
    echo "⚠️  next.config.ts: BACKEND_URL self-proxy 위험 — isSelfProxy 체크 적용 여부 확인"
  else
    echo "✅ next.config.ts: self-proxy 방지 패턴 확인됨"
  fi
fi

# .env.example 필수 변수 확인 (INSIGN 프로젝트)
if grep -q "NEXT_PUBLIC_GID\|NEXT_PUBLIC_GNB_LOGIN_ENV\|x-inface-user-uid" .env.example 2>/dev/null; then
  for VAR in DEV_UID DEV_MEMBER_SN; do
    grep -q "^${VAR}=" .env.example 2>/dev/null && echo "✅ .env.example: ${VAR} 존재" || echo "⚠️  .env.example: ${VAR} 누락 — 로컬 401 발생 위험"
  done
  # NEXT_PUBLIC_ 인증 변수 경고
  if grep -qE "^NEXT_PUBLIC_DEV_UID=|^NEXT_PUBLIC_DEV_MEMBER_SN=" .env.example 2>/dev/null; then
    echo "⚠️  .env.example: NEXT_PUBLIC_DEV_UID/DEV_MEMBER_SN — 클라이언트 번들 노출 위험 (보안 정책 위반)"
  fi
fi
```

### 인증 아키텍처 (Next.js + INFACE Gateway)

```bash
# middleware.ts에 페이지 인증 로직 감지
if [ -f middleware.ts ]; then
  if grep -qE "x-inface-user-uid|x-inface-user-guid" middleware.ts 2>/dev/null; then
    echo "⚠️  middleware.ts: Gateway 헤더로 페이지 인증 판별 — 프로덕션에서 동작 불가"
    echo "     페이지 보호는 useRequireAuth() 클라이언트 훅이 담당해야 함"
  else
    echo "✅ middleware.ts: Gateway 헤더 페이지 인증 패턴 없음"
  fi
fi

# AuthContext NEXT_PUBLIC_DEV_UID 의존 감지
if find . -name "AuthContext.*" -not -path "*/node_modules/*" | xargs grep -l "NEXT_PUBLIC_DEV_UID" 2>/dev/null | grep -q .; then
  echo "⚠️  AuthContext: NEXT_PUBLIC_DEV_UID — 프로덕션 빌드에 포함 위험. NODE_ENV 가드 확인 필요"
fi
```

### SSR/하이드레이션 (Next.js)

```bash
# 서버 컴포넌트에서 new Date() 직접 렌더링 감지
if find . -name "*.tsx" -o -name "*.jsx" 2>/dev/null | xargs grep -l "new Date()" 2>/dev/null | grep -v "node_modules\|\.test\.\|useClient" | grep -q .; then
  echo "⚠️  new Date() 직접 렌더링: SSR/CSR 불일치 → useClientDate() 훅 검토 필요"
  find . \( -name "*.tsx" -o -name "*.jsx" \) -not -path "*/node_modules/*" -not -name "*.test.*" | xargs grep -l "new Date()" 2>/dev/null | head -5
fi

# dangerouslySetInnerHTML에서 DOM style 직접 조작 감지
if find . -name "*.tsx" -o -name "*.jsx" 2>/dev/null | xargs grep -l "dangerouslySetInnerHTML" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  if find . \( -name "*.tsx" -o -name "*.jsx" \) -not -path "*/node_modules/*" | xargs grep -A5 "dangerouslySetInnerHTML" 2>/dev/null | grep -q "style\.setProperty\|style\.top\|style\.paddingTop"; then
    echo "⚠️  dangerouslySetInnerHTML: DOM 직접 style 조작 감지 → useEffect로 이관 권장 (하이드레이션 불일치)"
  fi
fi
```

### DB 안전성 (Prisma / TypeORM / Sequelize)

```bash
# TOCTOU 패턴 감지: findFirst/count 후 같은 파일에서 create
if find . -name "route.ts" -o -name "*.controller.ts" -o -name "*.service.ts" 2>/dev/null | xargs grep -l "findFirst\|\.count(" 2>/dev/null | grep -v "node_modules" | grep -q .; then
  FILES=$(find . \( -name "route.ts" -o -name "*.controller.ts" -o -name "*.service.ts" \) -not -path "*/node_modules/*" | xargs grep -l "findFirst\|\.count(" 2>/dev/null)
  for F in $FILES; do
    if grep -q "\.create(" "$F" 2>/dev/null; then
      if ! grep -q "\$transaction\|isolationLevel" "$F" 2>/dev/null; then
        echo "⚠️  $F: findFirst/count → create 패턴 + 트랜잭션 없음 — TOCTOU 레이스 컨디션 위험"
      fi
    fi
  done
fi

# take: 60 기반 totalCount 감지
if find . -name "*.ts" -not -path "*/node_modules/*" | xargs grep -l "take:" 2>/dev/null | grep -q .; then
  if find . -name "*.ts" -not -path "*/node_modules/*" | xargs grep -A2 "take:" 2>/dev/null | grep -q "\.length"; then
    echo "⚠️  take/limit 배열의 .length를 totalCount로 사용 감지 — _count 사용 권장"
  fi
fi
```

### 보안 신뢰 경계

```bash
# request.body에서 신원 정보 직접 읽기 감지
if find . \( -name "route.ts" -o -name "*.controller.ts" \) -not -path "*/node_modules/*" | xargs grep -l "body\.nexonId\|body\.memberSn\|body\.uid\|body\.userUid" 2>/dev/null | grep -q .; then
  echo "⚠️  request.body에서 신원 정보(nexonId/memberSn/uid) 직접 읽기 감지"
  echo "     lib/auth.ts 헬퍼 함수(getUid, getMemberSn) 사용 필요"
  find . \( -name "route.ts" -o -name "*.controller.ts" \) -not -path "*/node_modules/*" | xargs grep -l "body\.nexonId\|body\.memberSn" 2>/dev/null
fi
```

### HTTPS + 인증 셋업 검증 (보일러플레이트 v2 — Stage 1.6 / 2-F 산출물)

```bash
# state.json 의 셋업 키 검증
python3 -c "
import json, pathlib, sys
p = pathlib.Path('.claude/state.json')
if not p.exists():
    print('⚠️  state.json 없음 — boilerplate-setup 미실행')
    sys.exit(0)
d = json.loads(p.read_text())
keys = ['auth_profile', 'local_dev_host', 'https_ready', 'auth_storage_ready']
missing = [k for k in keys if k not in d or not d[k]]
if missing:
    print(f'⚠️  state.json 누락 키: {missing}')
    if d.get('auth_profile') == 'none':
        print('   (auth_profile=none 이면 auth_storage_ready 미필요 — 정상)')
else:
    print('✅ state.json: 보일러플레이트 셋업 완료 마커 모두 존재')
    for k in keys:
        print(f'   {k} = {d[k]}')
"

# storageState 만료 검증 (auth_profile != 'none' 인 경우)
# 정책(authentication-external.md A-4b): INSIGN/GNB 세션 만료는 서버 측 관리 → 쿠키 expires 가 단일 신뢰원.
# 파일 mtime 30일은 보조 안전망으로만 사용한다.
if [ -f tests/e2e/.auth/user.json ]; then
  LOCAL_DEV_HOST=$(python3 -c "import json; print(json.load(open('.claude/state.json')).get('local_dev_host', '<LOCAL_DEV_HOST>'))" 2>/dev/null || echo "<LOCAL_DEV_HOST>")
  AUTH_STATUS=$(STORAGE_FILE=tests/e2e/.auth/user.json node -e '
    const fs = require("fs");
    try {
      const state = JSON.parse(fs.readFileSync(process.env.STORAGE_FILE, "utf8"));
      const cookies = state.cookies || [];
      const authNames = ["_ifwt", "NXAS_TOKEN", "access_token", "authToken", "next-auth.session-token"];
      const auth = cookies.filter(c => c.name && authNames.some(n => c.name.toLowerCase().includes(n.toLowerCase())));
      if (auth.length === 0) { console.log("NO_AUTH_COOKIE"); process.exit(0); }
      const persistent = auth.filter(c => typeof c.expires === "number" && c.expires > 0);
      if (persistent.length === 0) { console.log("SESSION_ONLY"); process.exit(0); }
      const now = Math.floor(Date.now() / 1000);
      const maxExp = Math.max(...persistent.map(c => c.expires));
      if (maxExp < now) { console.log("EXPIRED:" + Math.floor((now - maxExp) / 86400)); process.exit(0); }
      const ageDays = Math.floor((Date.now() - fs.statSync(process.env.STORAGE_FILE).mtimeMs) / 86_400_000);
      if (ageDays > 30) { console.log("STALE_FILE:" + ageDays); process.exit(0); }
      console.log("VALID:" + Math.floor((maxExp - now) / 86400));
    } catch (e) { console.log("INVALID"); }
  ' 2>/dev/null || echo "INVALID")

  case "$AUTH_STATUS" in
    VALID:*)
      echo "✅ storageState 유효: 인증 쿠키 만료까지 ${AUTH_STATUS#VALID:}일 남음"
      ;;
    NO_AUTH_COOKIE)
      echo "⚠️  storageState 무효: 인증 쿠키(_ifwt/NXAS_TOKEN) 없음 — ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST} 재실행"
      ;;
    SESSION_ONLY)
      echo "⚠️  storageState 만료(세션 쿠키만 존재): 정책상 브라우저 종료 시 만료 — ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST} 재실행"
      ;;
    EXPIRED:*)
      echo "⚠️  storageState 만료: 인증 쿠키 expires ${AUTH_STATUS#EXPIRED:}일 경과 — ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST} 재실행"
      ;;
    STALE_FILE:*)
      echo "⚠️  storageState 만료(파일 안전망): ${AUTH_STATUS#STALE_FILE:}일 경과 — ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST} 재실행"
      ;;
    *)
      echo "⚠️  storageState 파싱 실패 — ./scripts/save-auth-state.sh https://${LOCAL_DEV_HOST} 재실행"
      ;;
  esac
fi

# Caddy 사이트 등록 확인 (현재 호스트)
LOCAL_DEV_HOST=$(python3 -c "import json; print(json.load(open('.claude/state.json')).get('local_dev_host', ''))" 2>/dev/null)
if [ -n "$LOCAL_DEV_HOST" ]; then
  CADDY_PREFIX=$(brew --prefix 2>/dev/null)
  SITE_FILE="${CADDY_PREFIX}/etc/d2a-sites/${LOCAL_DEV_HOST}.caddy"
  [ -f "$SITE_FILE" ] && echo "✅ Caddy 사이트: $SITE_FILE" || echo "⚠️  Caddy 사이트 미등록: $SITE_FILE"
fi
```

## Step 3: 항목별 점검

각 필수 항목을 하나씩 확인한다.
자동 확인 가능한 것은 자동으로, 수동 확인이 필요한 것은 질문한다.

**자동 확인 가능한 항목:**
```bash
# 빌드 통과 확인
npm run build && echo "✅ 빌드 통과"

# 테스트 통과 확인
npm test && echo "✅ 테스트 통과"

# 환경변수 필수값 확인
node -e "require('./src/config').validateEnv()" && echo "✅ 환경변수 설정 완료"
```

## Step 3-B: 에이전트 행동 신뢰성 검증

> AI 에이전트(Claude Code)가 이 프로젝트를 구현하는 동안 올바른 절차를 따랐는지 검증한다.
> 구현 품질과 별개로, 에이전트 자체의 행동 신뢰성을 확인하는 단계이다.

| # | 검증 항목 | 확인 방법 | 상태 |
|---|---|---|---|
| R-1 | **정책 참조 여부**: 각 태스크 실행 전 refs/policies/*.md를 참조했는가 | git log에서 "refs/policies" 언급 커밋 확인 | ⬜ |
| R-2 | **진단 점검 수행**: 빌드/테스트 실패 시 오류를 분석하고 수정했는가 | blockers.md 존재 시 해결 기록 확인 | ⬜ |
| R-3 | **컨텍스트 검색 준수**: tasks.md의 read 필드 외 파일을 무단 로드하지 않았는가 | tasks.md no-read 파일이 실제로 미접근인지 확인 | ⬜ |
| R-4 | **스펙 파라미터 일치**: API 응답 필드가 api-spec.yaml과 일치하는가 | `diff <(grep -r "return" src/) contracts/api-spec.yaml` 수동 확인 | ⬜ |
| R-5 | **가드레일 준수**: 자동 실행 제외 명령(rm -rf, push --force 등)이 실행되지 않았는가 | git log에서 위험 명령 흔적 없음 확인 | ⬜ |

**자동 검증:**
```bash
# R-1: 정책 참조 커밋 확인
git log --oneline | grep -i "refs/policies" | wc -l

# R-5: 위험 명령 실행 흔적 확인
git log --oneline --all | grep -E "(force|drop table|rm -rf)" | head -5
```

R-1~R-5 중 하나라도 ⬜인 상태로 배포하면 에이전트 행동 감사 로그가 불완전하다.
Critical 배포(유저용 서비스)에서는 R-1~R-5 모두 통과가 필수이다.

## Step 4: 결과 요약

```
## 배포 전 체크 결과

### 서비스 품질 체크
✅ 통과: {N}개
❌ 미통과: {N}개
⬜ 확인 필요: {N}개

### 에이전트 행동 신뢰성 (R-1~R-5)
✅ 통과: {N}개
⬜ 미확인: {N}개

### 미통과 항목 조치 방법
1. {항목}: {조치 방법, 담당팀, 예상 소요 시간}

{모두 통과 시} → "배포 준비가 완료되었습니다."
{미통과 있을 시} → "위 항목을 조치한 후 다시 체크해주세요."
```
