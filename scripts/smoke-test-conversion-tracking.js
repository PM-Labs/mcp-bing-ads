#!/usr/bin/env node
/**
 * Live smoke test for the conversion-tracking tools (bing_ads_list_conversion_goals,
 * bing_ads_conversion_performance) plus a regression check on the three existing
 * reporting tools whose Conversions column now sources from ConversionsQualified.
 *
 * Usage:
 *   node scripts/smoke-test-conversion-tracking.js <base-url> <bearer-token> <account-id>
 *   node scripts/smoke-test-conversion-tracking.js https://bing-ads.mcp.pathfindermarketing.com.au $TOKEN 176795228
 *
 * Exits 0 on all checks passing, 1 otherwise.
 */
const [, , BASE_URL, TOKEN, ACCOUNT_ID] = process.argv;
if (!BASE_URL || !TOKEN || !ACCOUNT_ID) {
  console.error('Usage: smoke-test-conversion-tracking.js <base-url> <bearer-token> <account-id>');
  process.exit(2);
}

const MCP_URL = BASE_URL.replace(/\/+$/, '') + '/mcp';
const HEADERS_JSON = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
  'Authorization': `Bearer ${TOKEN}`,
};

async function postJson(body, extraHeaders = {}) {
  const res = await fetch(MCP_URL, { method: 'POST', headers: { ...HEADERS_JSON, ...extraHeaders }, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function parseSse(text) {
  const dataLines = text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
  if (dataLines.length) return JSON.parse(dataLines[dataLines.length - 1]);
  return JSON.parse(text);
}

let id = 1;
async function call(sessionId, method, params) {
  const res = await postJson({ jsonrpc: '2.0', id: id++, method, params }, { 'mcp-session-id': sessionId });
  if (res.status !== 200) fail(`${method} returned non-200`, `status=${res.status} body=${res.text.slice(0, 800)}`);
  return parseSse(res.text);
}

function fail(label, detail) {
  console.error(`FAIL: ${label}`);
  if (detail) console.error(detail);
  process.exit(1);
}
function pass(label) {
  console.log(`PASS: ${label}`);
}

function toolText(result, toolName) {
  if (result.result?.isError) fail(`${toolName} returned an MCP-level error`, JSON.stringify(result.result));
  const text = result.result?.content?.[0]?.text;
  if (!text) fail(`${toolName} returned no content`, JSON.stringify(result));
  try {
    return JSON.parse(text);
  } catch {
    fail(`${toolName} response was not valid JSON`, text.slice(0, 500));
  }
}

(async () => {
  const init = await postJson({
    jsonrpc: '2.0',
    id: id++,
    method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test-conversion-tracking', version: '1.0' } },
  });
  if (init.status !== 200) fail('initialize returned non-200', `status=${init.status} body=${init.text.slice(0, 500)}`);
  const sessionId = init.headers.get('mcp-session-id');
  await postJson({ jsonrpc: '2.0', method: 'notifications/initialized' }, { 'mcp-session-id': sessionId });

  const list = await call(sessionId, 'tools/list', {});
  const names = (list.result?.tools || []).map((t) => t.name);
  if (!names.includes('bing_ads_list_conversion_goals') || !names.includes('bing_ads_conversion_performance')) {
    fail('new tools missing from tools/list', names.join(', '));
  }
  pass('tools/list includes both new conversion tools');

  const goalsResult = await call(sessionId, 'tools/call', { name: 'bing_ads_list_conversion_goals', arguments: { account_id: ACCOUNT_ID } });
  const goalsBody = toolText(goalsResult, 'bing_ads_list_conversion_goals');
  if (goalsBody.error) fail('bing_ads_list_conversion_goals returned an error payload', JSON.stringify(goalsBody));
  if (!Array.isArray(goalsBody.goals)) fail('bing_ads_list_conversion_goals response missing goals array', JSON.stringify(goalsBody).slice(0, 500));
  pass(`bing_ads_list_conversion_goals returned ${goalsBody.goals.length} goal(s)`);

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const startDate = fmt(weekAgo);
  const endDate = fmt(today);

  const perfResult = await call(sessionId, 'tools/call', { name: 'bing_ads_conversion_performance', arguments: { account_id: ACCOUNT_ID, start_date: startDate, end_date: endDate } });
  const perfBody = toolText(perfResult, 'bing_ads_conversion_performance');
  if (perfBody.error) fail('bing_ads_conversion_performance returned an error payload', JSON.stringify(perfBody));
  if (!Array.isArray(perfBody)) fail('bing_ads_conversion_performance response was not an array', JSON.stringify(perfBody).slice(0, 500));
  if (perfBody.length && ('Goal' in perfBody[0] || 'GoalId' in perfBody[0])) fail('bing_ads_conversion_performance without by_goal unexpectedly returned Goal columns');
  pass(`bing_ads_conversion_performance (no by_goal) returned ${perfBody.length} row(s), no Goal columns`);

  const perfByGoalResult = await call(sessionId, 'tools/call', { name: 'bing_ads_conversion_performance', arguments: { account_id: ACCOUNT_ID, start_date: startDate, end_date: endDate, by_goal: true } });
  const perfByGoalBody = toolText(perfByGoalResult, 'bing_ads_conversion_performance(by_goal)');
  if (perfByGoalBody.error) fail('bing_ads_conversion_performance(by_goal) returned an error payload', JSON.stringify(perfByGoalBody));
  if (!Array.isArray(perfByGoalBody)) fail('bing_ads_conversion_performance(by_goal) response was not an array', JSON.stringify(perfByGoalBody).slice(0, 500));
  if (perfByGoalBody.length && !('Goal' in perfByGoalBody[0] && 'GoalId' in perfByGoalBody[0])) {
    fail('bing_ads_conversion_performance(by_goal=true) missing Goal/GoalId columns');
  }
  pass(`bing_ads_conversion_performance (by_goal=true) returned ${perfByGoalBody.length} row(s) with Goal columns`);

  // Regression check: the three existing tools now request ConversionsQualified instead of the
  // deprecated Conversions column -- and the JSON key changes accordingly (parseCsv() uses the
  // requested column name verbatim as the response key), so this checks for ConversionsQualified.
  const regressionTools = [
    { name: 'bing_ads_get_campaign_performance', args: { account_id: ACCOUNT_ID, start_date: startDate, end_date: endDate } },
    { name: 'bing_ads_keyword_performance', args: { account_id: ACCOUNT_ID, start_date: startDate, end_date: endDate } },
    { name: 'bing_ads_search_term_report', args: { account_id: ACCOUNT_ID, start_date: startDate, end_date: endDate } },
  ];
  for (const t of regressionTools) {
    const r = await call(sessionId, 'tools/call', { name: t.name, arguments: t.args });
    const body = toolText(r, t.name);
    if (body.error) fail(`${t.name} regression check failed`, JSON.stringify(body));
    if (!Array.isArray(body)) fail(`${t.name} response was not an array`, JSON.stringify(body).slice(0, 500));
    if (body.length && !('ConversionsQualified' in body[0])) fail(`${t.name} response missing ConversionsQualified field`, JSON.stringify(body[0]));
    pass(`${t.name} regression check: ${body.length} row(s), ConversionsQualified field present`);
  }

  console.log('\nAll conversion-tracking smoke test assertions passed.');
})();
