import pc from "picocolors";
import type { Finding, SkillReport, Severity } from "./types.js";

const SEV_ICON: Record<Severity, string> = {
  error: "✖",
  warning: "⚠",
  info: "ℹ",
};

function colorSev(sev: Severity, text: string): string {
  if (sev === "error") return pc.red(text);
  if (sev === "warning") return pc.yellow(text);
  return pc.dim(text);
}

function printFindings(title: string, findings: Finding[]): void {
  if (findings.length === 0) {
    console.log(`  ${pc.green("✓")} ${title}: clean`);
    return;
  }
  console.log(`  ${title}:`);
  for (const f of findings) {
    const loc = f.file ? pc.dim(`${f.file}${f.line ? `:${f.line}` : ""}`) : "";
    console.log(`    ${colorSev(f.severity, SEV_ICON[f.severity])} ${f.message} ${loc}`);
    console.log(`      ${pc.dim(f.id)}`);
    if (f.hint) console.log(`      ${pc.dim("→ " + f.hint)}`);
  }
}

/** Pretty-print a full skill report to the terminal. */
export function printReport(report: SkillReport): void {
  console.log("");
  console.log(pc.bold(`▶ ${report.skillName}`) + pc.dim(`  (${report.skillPath})`));
  printFindings("lint", report.lint);
  printFindings("audit", report.audit);

  if (report.scenarios.length === 0) {
    console.log(`  ${pc.dim("○")} tests: no scenario file found`);
  } else {
    console.log("  tests:");
    for (const s of report.scenarios) {
      if (s.skipped) {
        console.log(`    ${pc.dim("○ skipped")} ${s.scenario} ${pc.dim(`(${s.reasons[0] ?? ""})`)}`);
        continue;
      }
      const mark = s.passed ? pc.green("✓ pass") : pc.red("✖ fail");
      console.log(`    ${mark} ${s.scenario} ${pc.dim(`${s.durationMs}ms`)}`);
      for (const r of s.reasons) console.log(`        ${pc.red("·")} ${r}`);
    }
  }

  const badge = report.verified ? pc.green(pc.bold(" VERIFIED ")) : pc.red(pc.bold(" NOT VERIFIED "));
  const scoreColor = report.score >= 80 ? pc.green : report.score >= 50 ? pc.yellow : pc.red;
  console.log(`  ${badge}  score ${scoreColor(String(report.score) + "/100")}`);
}

/** Render an array of reports as a self-contained HTML page. */
export function renderHtml(reports: SkillReport[]): string {
  const rows = reports
    .map((r) => {
      const findings = [...r.lint, ...r.audit];
      const findingRows = findings
        .map(
          (f) =>
            `<li class="sev-${f.severity}"><code>${f.id}</code> ${escapeHtml(f.message)}${
              f.file ? ` <span class="loc">${escapeHtml(f.file)}${f.line ? ":" + f.line : ""}</span>` : ""
            }</li>`
        )
        .join("");
      const testRows = r.scenarios
        .map((s) => {
          const cls = s.skipped ? "skip" : s.passed ? "pass" : "fail";
          const label = s.skipped ? "skipped" : s.passed ? "pass" : "fail";
          const reasons = s.reasons.length ? `<div class="reasons">${s.reasons.map(escapeHtml).join("<br>")}</div>` : "";
          return `<li class="test ${cls}"><b>${label}</b> ${escapeHtml(s.scenario)}${reasons}</li>`;
        })
        .join("");
      return `<section class="skill ${r.verified ? "ok" : "bad"}">
        <h2>${escapeHtml(r.skillName)} <span class="score">${r.score}/100</span>
        <span class="badge ${r.verified ? "v" : "nv"}">${r.verified ? "VERIFIED" : "NOT VERIFIED"}</span></h2>
        <p class="path">${escapeHtml(r.skillPath)}</p>
        <ul class="findings">${findingRows || '<li class="sev-info">No lint/audit findings.</li>'}</ul>
        <ul class="tests">${testRows || '<li class="test skip">No scenarios.</li>'}</ul>
      </section>`;
    })
    .join("\n");

  const verifiedCount = reports.filter((r) => r.verified).length;
  return `<!doctype html><html><head><meta charset="utf-8">
<title>skillci report</title>
<style>
  :root{color-scheme:light dark}
  body{font:15px/1.5 ui-sans-serif,system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem}
  h1{font-size:1.5rem}
  .summary{color:#666;margin-bottom:1.5rem}
  .skill{border:1px solid #8883;border-radius:10px;padding:1rem 1.25rem;margin:1rem 0}
  .skill.ok{border-left:4px solid #1a9d4b}
  .skill.bad{border-left:4px solid #d33}
  h2{font-size:1.15rem;display:flex;align-items:center;gap:.6rem;margin:.2rem 0}
  .score{font-weight:600;color:#888;font-size:.9rem}
  .badge{font-size:.7rem;padding:.15rem .5rem;border-radius:999px;font-weight:700;letter-spacing:.04em}
  .badge.v{background:#1a9d4b;color:#fff}.badge.nv{background:#d33;color:#fff}
  .path{color:#888;font-size:.8rem;margin:.1rem 0 .6rem}
  ul{list-style:none;padding:0;margin:.4rem 0}
  .findings li{padding:.2rem 0;font-size:.9rem}
  .sev-error{color:#d33}.sev-warning{color:#b80}.sev-info{color:#888}
  code{background:#8881;padding:.05rem .35rem;border-radius:4px;font-size:.85em}
  .loc{color:#999;font-size:.8em}
  .tests li{padding:.2rem 0;font-size:.9rem}
  .test.pass b{color:#1a9d4b}.test.fail b{color:#d33}.test.skip b{color:#999}
  .reasons{color:#d33;font-size:.82rem;margin:.1rem 0 .1rem 1rem}
</style></head><body>
<h1>skillci report</h1>
<p class="summary">${verifiedCount}/${reports.length} skills verified · generated ${new Date().toISOString()}</p>
${rows}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
