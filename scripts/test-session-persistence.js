#!/usr/bin/env node
/**
 * Session-persistence smoke test for Pathfinder MCP servers.
 *
 * Detects whether the server is running in stateful or stateless mode and
 * runs the appropriate assertion set. The bug this test guards against
 * (session resurrection — see PM-Labs/mcp-playwright@1d75780) only applies
 * to stateful servers; stateless servers cannot exhibit it.
 *
 * Usage:
 *   node scripts/test-session-persistence.js <base-url> <bearer-token>
 *   node scripts/test-session-persistence.js https://bing-ads.mcp.pathfindermarketing.com.au $MCP_BING_ADS_TOKEN
 *
 * Exits 0 on all assertions passing, 1 otherwise.
 */
import { randomUUID } from 'node:crypto';

const [, , BASE_URL, TOKEN] = process.argv;
if (!BASE_URL || !TOKEN) {
  console.error('Usage: test-session-persistence.js <base-url> <bearer-token>');
  process.exit(2);
}

const MCP_URL = BASE_URL.replace(/\/+$/, '') + '/mcp';
const HEADERS_JSON = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/event-stream',
  'Authorization': `Bearer ${TOKEN}`,
};

async function postJson(body, extraHeaders = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { ...HEADERS_JSON, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function fail(label, detail) {
  console.error(`FAIL: ${label}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function pass(label) {
  console.log(`PASS: ${label}`);
}

(async () => {
  const init = await postJson({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-session-persistence', version: '1.0' },
    },
  });
  if (init.status !== 200) {
    fail('initialize returned non-200', `status=${init.status} body=${init.text.slice(0, 500)}`);
  }

  const sessionId = init.headers.get('mcp-session-id');

  if (sessionId) {
    pass(`initialize -> session ${sessionId.slice(0, 8)}... (mode: STATEFUL)`);

    await postJson(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { 'mcp-session-id': sessionId }
    );

    const list = await postJson(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { 'mcp-session-id': sessionId }
    );
    if (list.status !== 200) {
      fail('tools/list on active session returned non-200', `status=${list.status} body=${list.text.slice(0, 500)}`);
    }
    const returnedId = list.headers.get('mcp-session-id');
    if (returnedId && returnedId !== sessionId) {
      fail(
        'server rewrote session id mid-conversation (session resurrection regression)',
        `sent=${sessionId} received=${returnedId}`
      );
    }
    pass('tools/list persisted session id (no rewrite)');

    const bogus = randomUUID();
    const unknown = await postJson(
      { jsonrpc: '2.0', id: 3, method: 'tools/list' },
      { 'mcp-session-id': bogus }
    );
    if (unknown.status !== 404) {
      fail(
        'unknown session id did not return 404 (session resurrection regression)',
        `status=${unknown.status} body=${unknown.text.slice(0, 500)}`
      );
    }
    pass('unknown session id -> 404');

    console.log('\nAll session-persistence assertions passed.');
    return;
  }

  pass('initialize -> 200 with no session header (mode: STATELESS)');

  const list = await postJson({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  if (list.status !== 200) {
    fail('stateless tools/list (no session header) returned non-200', `status=${list.status} body=${list.text.slice(0, 500)}`);
  }
  pass('tools/list (no session header) -> 200');

  const bogus = randomUUID();
  const withBogus = await postJson(
    { jsonrpc: '2.0', id: 3, method: 'tools/list' },
    { 'mcp-session-id': bogus }
  );
  if (withBogus.status !== 200 && withBogus.status !== 404) {
    fail(
      'stateless server mishandled bogus session header',
      `status=${withBogus.status} body=${withBogus.text.slice(0, 500)}`
    );
  }
  pass(`tools/list with bogus session header -> ${withBogus.status} (acceptable)`);

  console.log('\nAll stateless assertions passed.');
})().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
