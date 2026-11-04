#!/usr/bin/env bash
# verify-hosted-relay.sh — Run after applying migration 0003 on the hosted Supabase project.
# Tests: (1) migration is applied, (2) gateway XFF ownership, (3) rate limit works.
set -euo pipefail

ANON="sb_publishable_HV50FQtJrkoNcKLsFk5BHQ_KUU2GeKb"
URL="https://qvwitlpnetwthyhrobca.supabase.co"

echo "=== Test 1: Migration 0003 applied? ==="
SPACE=$(python3 -c "print('a'*64)")
AUTH=$(python3 -c "print('b'*64)")
RESP=$(curl -s -X POST "$URL/rest/v1/rpc/sync_claim" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $ANON" \
  -d "{\"p_space\":\"$SPACE\",\"p_auth_hash\":\"$AUTH\"}" \
  -w "\n%{http_code}")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
echo "HTTP $STATUS: $BODY"
if [ "$STATUS" = "403" ]; then
  echo "PASS: Migration 0003 is active (fail-closed without IP header)."
elif [ "$STATUS" = "200" ]; then
  echo "FAIL: Migration 0003 is NOT applied (request succeeded without IP header)."
  echo "      Apply docs/migrations/0003_trusted_ip_rate_limit.sql via the SQL Editor."
  exit 1
else
  echo "UNEXPECTED: HTTP $STATUS"
  exit 1
fi

echo ""
echo "=== Test 2: Gateway provides cf-connecting-ip or XFF? ==="
# Send request WITH cf-connecting-ip and XFF to see if gateway passes them through
SPACE2=$(python3 -c "print('c'*64)")
AUTH2=$(python3 -c "print('d'*64)")
RESP2=$(curl -s -X POST "$URL/rest/v1/rpc/sync_claim" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $ANON" \
  -H "cf-connecting-ip: 10.0.0.99" \
  -H "X-Forwarded-For: 10.0.0.99" \
  -d "{\"p_space\":\"$SPACE2\",\"p_auth_hash\":\"$AUTH2\"}" \
  -w "\n%{http_code}")
STATUS2=$(echo "$RESP2" | tail -1)
BODY2=$(echo "$RESP2" | head -1)
echo "HTTP $STATUS2: $BODY2"
if [ "$STATUS2" = "403" ] && echo "$BODY2" | grep -q "client_ip_unavailable"; then
  echo "WARNING: Gateway stripped cf-connecting-ip and XFF; no trusted IP available."
  echo "         Sync will NOT work for real users. Check Supabase gateway config."
  exit 1
elif [ "$STATUS2" = "200" ] || [ "$STATUS2" = "400" ]; then
  echo "PASS: Gateway provides a trusted IP (request succeeded)."
else
  echo "UNEXPECTED: HTTP $STATUS2"
  exit 1
fi

echo ""
echo "=== Test 3: Gateway XFF ownership (spoofing test) ==="
echo "Exhausting 251 requests from spoofed IP 10.0.0.1..."
for i in $(seq 1 251); do
  curl -s -o /dev/null -X POST "$URL/rest/v1/rpc/sync_claim" \
    -H "Content-Type: application/json" \
    -H "apikey: $ANON" \
    -H "Authorization: Bearer $ANON" \
    -H "cf-connecting-ip: 10.0.0.1" \
    -H "X-Forwarded-For: 10.0.0.1" \
    -d '{"p_space":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","p_auth_hash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}'
done

echo "Now trying from spoofed IP 10.0.0.2 (should be 429 if gateway overwrites, 200 if vulnerable)..."
SPACE3=$(python3 -c "print('e'*64)")
AUTH3=$(python3 -c "print('f'*64)")
RESP3=$(curl -s -X POST "$URL/rest/v1/rpc/sync_claim" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $ANON" \
  -H "cf-connecting-ip: 10.0.0.2" \
  -H "X-Forwarded-For: 10.0.0.2" \
  -d "{\"p_space\":\"$SPACE3\",\"p_auth_hash\":\"$AUTH3\"}" \
  -w "\n%{http_code}")
STATUS3=$(echo "$RESP3" | tail -1)
BODY3=$(echo "$RESP3" | head -1)
echo "HTTP $STATUS3: $BODY3"
if [ "$STATUS3" = "429" ]; then
  echo "PASS: Gateway overwrites spoofed headers (secure)."
elif [ "$STATUS3" = "200" ] || [ "$STATUS3" = "400" ]; then
  echo "FAIL: Gateway trusts client-supplied headers (vulnerable to IP spoofing)."
  echo "      Consider putting a Cloudflare Worker or Edge Function in front."
  exit 1
else
  echo "UNEXPECTED: HTTP $STATUS3"
  exit 1
fi

echo ""
echo "=== All gateway checks passed ==="