// 화면 자동 점검 결과를 "화면점검결과.txt" 한 장으로 적는 리포터.
//
// 왜 기본 리포터를 안 쓰나: 이 파일의 독자는 **온도 관계자**다(2026-10-23 무인 테스트 전제).
// Playwright 기본 출력은 영어에 스택이 길고 체크리스트 번호와 연결되지 않는다. 여기서는
// 테스트 이름 앞의 "B-4-9" 번호를 그대로 묶어 적어서, 온도 측이 "B-4 의 9번이 ❌" 한 줄만
// 전해도 개발자가 바로 자리를 찾을 수 있게 한다(체크리스트 "문제가 있을 때" 항목과 같은 형식).
//
// 파일은 UTF-8 BOM으로 쓴다 — 메모장이 BOM 없는 UTF-8을 cp949로 잘못 읽는 경우가 있다.
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { BROWSER_CHANNEL } from '../../playwright.config.js';

const GROUP_TITLES: Record<string, string> = {
  'B-1': '메인 화면(왼쪽)',
  'B-2': '현재 모드',
  'B-3': '예측 모드',
  'B-4': '전문가 모드',
  'B-5': '제어 모드',
  'B-6': '마무리',
};

interface Row {
  group: string;
  no: number;
  title: string;
  status: TestResult['status'];
  mark: string;
  detail: string[];
  shots: string[];
}

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

/** 실패 메시지에서 사람이 읽을 첫 줄들만 뽑는다(스택·코드 프레임은 버린다). */
function errorLines(result: TestResult): string[] {
  const out: string[] = [];
  for (const error of result.errors) {
    for (const line of stripAnsi(error.message ?? '').split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '') continue;
      if (/^at\s/.test(trimmed)) break;
      if (/^\d+\s*\|/.test(trimmed)) continue; // 코드 프레임
      if (/^[\s^]+$/.test(trimmed)) continue;
      out.push(trimmed);
      if (out.length >= 4) break;
    }
    if (out.length >= 4) break;
  }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 밀리초를 "1분 23초"로. 온도 측이 읽을 문구라 한국어로 적는다. */
function duration(ms: number): string {
  const total = Math.max(Math.round(ms / 1000), 0);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
}

/**
 * 항목 하나에 걸리는 평균 시간(초) — 남은 시간을 처음 가늠할 때만 쓴다. 2026-10-18 실측
 * (56항목 약 1분 54초 ≈ 2.0초/항목)에 여유를 둔 값이고, 몇 항목만 지나면 그 PC의 실제
 * 평균으로 바뀐다.
 */
const ASSUMED_SECONDS_PER_TEST = 2.5;

export default class OndoChecklistReporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = new Date();
  private startedMs = Date.now();
  private totalTests = 0;
  private doneTests = 0;
  private outputDir = 'ui-test-results';
  private baseUrl = '';
  private browserName = '';

  onBegin(config: FullConfig, suite: Suite): void {
    this.startedAt = new Date();
    this.startedMs = Date.now();
    this.totalTests = suite.allTests().length;
    const project = config.projects[0];
    this.outputDir = project ? relative(process.cwd(), project.outputDir) : 'ui-test-results';
    const use = (project?.use ?? {}) as { baseURL?: string };
    this.baseUrl = use.baseURL ?? '';
    this.browserName = BROWSER_CHANNEL ?? 'chromium(Playwright 번들)';

    const rough = duration(this.totalTests * ASSUMED_SECONDS_PER_TEST * 1000);
    process.stdout.write(
      [
        '',
        `화면 자동 점검을 시작합니다 — 항목 ${this.totalTests}개, 예상 ${rough} 안팎(PC가 느리면 더 걸립니다).`,
        '크롬 창이 저절로 열리고 닫힙니다. 건드리지 말고 그대로 두세요.',
        '',
        '',
      ].join('\n'),
    );
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const match = /^(B-\d+)-(\d+)\s+(.*)$/.exec(test.title);
    const passed = result.status === 'passed';
    const skipped = result.status === 'skipped';

    this.rows.push({
      group: match?.[1] ?? '기타',
      no: Number(match?.[2] ?? 0),
      title: match?.[3] ?? test.title,
      status: result.status,
      mark: skipped ? '건너뜀' : passed ? 'OK' : '실패',
      detail: passed || skipped ? [] : errorLines(result),
      shots: result.attachments
        .filter((a) => a.name === 'screenshot' && a.path)
        .map((a) => relative(process.cwd(), a.path as string)),
    });

    // 진행 한 줄 — 남은 시간은 지금까지의 실제 평균으로 다시 계산한다(처음 한 항목은 가정값).
    this.doneTests += 1;
    const elapsed = Date.now() - this.startedMs;
    const perTest = elapsed / this.doneTests;
    const remain = Math.max(this.totalTests - this.doneTests, 0) * perTest;
    const mark = skipped ? '건너뜀' : passed ? 'OK' : '실패';
    const counter = `${String(this.doneTests).padStart(String(this.totalTests).length, ' ')}/${this.totalTests}`;
    const tail = remain > 0 ? `, 남은 예상 ${duration(remain)}` : '';
    process.stdout.write(`[${counter}] [${mark}] ${test.title}  (경과 ${duration(elapsed)}${tail})\n`);
  }

  onEnd(result: FullResult): void {
    const lines: string[] = [];
    const d = this.startedAt;
    const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    lines.push('온도 돈사 대시보드 - 화면 자동 점검 결과 (테스트 체크리스트 B부)');
    lines.push('='.repeat(66));
    lines.push(`실행 시각 : ${stamp}`);
    lines.push(`소요 시간 : ${duration(Date.now() - this.startedMs)}`);
    lines.push(`주소      : ${this.baseUrl}`);
    lines.push(`브라우저  : ${this.browserName} / 화면 1920x1080`);
    lines.push('');

    for (const group of [...new Set(this.rows.map((r) => r.group))].sort()) {
      lines.push(`[${group}] ${GROUP_TITLES[group] ?? ''}`.trimEnd());
      for (const row of this.rows.filter((r) => r.group === group).sort((a, b) => a.no - b.no)) {
        lines.push(`  [${row.mark}] ${group}-${row.no} ${row.title}`);
        for (const detail of row.detail) lines.push(`         ${detail}`);
        for (const shot of row.shots) lines.push(`         화면 캡처: ${shot}`);
      }
      lines.push('');
    }

    const passed = this.rows.filter((r) => r.status === 'passed').length;
    const failed = this.rows.filter((r) => r.status !== 'passed' && r.status !== 'skipped');
    const skipped = this.rows.filter((r) => r.status === 'skipped');

    lines.push('='.repeat(66));
    lines.push(`합계 : 정상 ${passed} / 실패 ${failed.length} / 건너뜀 ${skipped.length}  (전체 ${this.rows.length}개)`);
    if (failed.length > 0) {
      lines.push(`실패 항목 : ${failed.map((r) => `${r.group}-${r.no}`).join(', ')}`);
      lines.push('');
      lines.push(`※ 이 파일과 "${this.outputDir}" 폴더(실패한 항목의 화면 캡처)를 그대로`);
      lines.push('   개발자에게 보내 주세요. 캡처가 원인을 찾는 가장 빠른 단서입니다.');
    } else if (result.status === 'passed') {
      lines.push('모든 항목이 정상입니다. 체크리스트 B부는 이 파일로 대체해 주세요.');
    }
    if (skipped.length > 0) {
      lines.push('');
      lines.push(`건너뜀 : ${skipped.map((r) => `${r.group}-${r.no}`).join(', ')}`);
    }
    lines.push('');
    lines.push('자동으로 판정할 수 없어 사람이 직접 봐야 하는 항목은 테스트-체크리스트.md의');
    lines.push('"B부 — 사람이 직접 봐야 하는 항목"을 확인해 주세요.');
    lines.push('');

    const target = join(process.cwd(), '화면점검결과.txt');
    const bom = String.fromCharCode(0xfeff);
    writeFileSync(target, `${bom}${lines.join('\r\n')}`, 'utf8');
    process.stdout.write(
      [
        '',
        `점검을 마쳤습니다 — 정상 ${passed} / 실패 ${failed.length} / 건너뜀 ${skipped.length}, 걸린 시간 ${duration(
          Date.now() - this.startedMs,
        )}`,
        `결과를 적었습니다: ${target}`,
        '',
      ].join('\n'),
    );
  }
}
