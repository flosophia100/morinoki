// Supabase Edge Function: mail_outbox を消化して実メール送信
//
// 必要な環境変数(Supabase Functions secrets):
//   RESEND_API_KEY  — Resend (https://resend.com) のAPIキー
//   RESEND_FROM     — 送信元アドレス(例: "morinoki <noreply@yourdomain.com>")
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — 自動で入る
//
// 呼び出し: HTTPで叩けばキューを一括処理する。Cronで1分毎に叩く想定。
// 初回登録メール・合言葉再発行メール等、すべてこれ一本で対応。

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')!;
const FROM         = Deno.env.get('RESEND_FROM') || 'morinoki <noreply@example.com>';

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

async function sendMail(to: string, subject: string, text: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (_req) => {
  const { data: queue, error } = await db
    .from('mail_outbox')
    .select('id, to_email, subject, body')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return new Response('queue fetch failed: ' + error.message, { status: 500 });
  if (!queue?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  let sent = 0;
  for (const row of queue) {
    try {
      await sendMail(row.to_email, row.subject, row.body);
      await db.from('mail_outbox').update({ sent_at: new Date().toISOString() }).eq('id', row.id);
      sent++;
    } catch (e) {
      console.error('send failed', row.id, (e as Error).message);
    }
  }
  return new Response(JSON.stringify({ sent }), {
    headers: { 'content-type': 'application/json' },
  });
});
