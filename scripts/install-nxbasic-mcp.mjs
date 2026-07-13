// install-nxbasic-mcp.mjs — 대상 보일러플레이트 프로젝트에 nxbasic-mcp 서버를 등록한다.
//
// 왜 프로젝트 .mcp.json 인가:
//   · 사용자 전역 ~/.claude.json 을 스크립트로 편집하는 것은 위험하다(인증·프로젝트 히스토리 등이
//     한 파일에 있어 잘못 쓰면 Claude Code 전체가 깨진다). 프로젝트 루트 .mcp.json 은 스코프가
//     프로젝트로 한정되고, Claude Code 가 최초 사용 시 승인 프롬프트를 띄운다 — "조용한 자동 실행"이
//     아니라 "자동 등록 + 사용자 승인"이라 안전하다.
//   · 기존 .mcp.json 이 있으면 그 안의 다른 서버는 보존하고 nxbasic-mcp 항목만 병합한다.
//
// 사용법:
//   node scripts/install-nxbasic-mcp.mjs <프로젝트 루트>
//   (install.sh / install.ps1 가 MCP 재빌드 직후 자동 호출한다)
//
// 멱등: 이미 동일 URL 로 등록돼 있으면 건너뛴다. 다른 값이면 최신 정의로 갱신한다.

import fs from 'node:fs';
import path from 'node:path';

const REMOTE_URL = 'https://nxbasic-mcp.sooyachoco.workers.dev/mcp';
const SERVER_KEY = 'nxbasic-mcp';

// 플랫폼별 실행 형태 — Windows 는 npx 가 npx.cmd 라 cmd /c 래퍼가 필요하다.
// (사용자의 검증된 설정과 동일하게 맞춘다.)
function serverEntry() {
  const base = ['-y', 'mcp-remote', REMOTE_URL];
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'npx', ...base], env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } };
  }
  return { command: 'npx', args: base, env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } };
}

// 두 서버 정의가 실질적으로 같은가(플랫폼 차이는 무시하고 원격 URL 기준).
function sameRemote(entry) {
  return Array.isArray(entry?.args) && entry.args.includes(REMOTE_URL);
}

function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('사용법: node scripts/install-nxbasic-mcp.mjs <프로젝트 루트>');
    process.exit(1);
  }
  // 대상 결정: template/ 가 있으면 그 안(보일러플레이트 본체 루트), 아니면 target 자체.
  const root = fs.existsSync(path.join(target, 'template'))
    ? path.join(target, 'template')
    : target;
  const mcpPath = path.join(root, '.mcp.json');

  let doc = { mcpServers: {} };
  if (fs.existsSync(mcpPath)) {
    try {
      doc = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      if (!doc.mcpServers || typeof doc.mcpServers !== 'object') doc.mcpServers = {};
    } catch (e) {
      console.error(`  ⚠️  ${path.relative(target, mcpPath)} 파싱 실패 — 손상 방지를 위해 자동 편집을 건너뜁니다.`);
      console.error(`      직접 mcpServers.${SERVER_KEY} 항목을 추가하세요. 원인: ${e.message}`);
      process.exit(1); // 덮어쓰지 않는다 — 기존 파일 보존이 우선
    }
  }

  const existing = doc.mcpServers[SERVER_KEY];
  if (existing && sameRemote(existing)) {
    console.log(`  ✓ ${SERVER_KEY} 이미 등록됨 (${path.relative(target, mcpPath)}) — 건너뜀`);
    return;
  }

  const action = existing ? '갱신' : '추가';
  doc.mcpServers[SERVER_KEY] = serverEntry();
  fs.writeFileSync(mcpPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ ${SERVER_KEY} ${action} → ${path.relative(target, mcpPath)} (${process.platform})`);
  console.log('    ⓘ Claude Code 가 최초 사용 시 이 서버 승인을 물어봅니다(자동 실행 아님).');
  console.log('    ⓘ NODE_TLS_REJECT_UNAUTHORIZED=0 포함 — 사내 원격 워커 인증서 대응(검증된 설정과 동일).');
}

main();
