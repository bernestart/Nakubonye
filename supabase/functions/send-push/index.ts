// supabase/functions/send-push/index.ts
// Sends FCM push notifications to a user's devices.
//
// Auth: requires SUPABASE_SERVICE_ROLE_KEY in Authorization header.
// Body: { user_id: string, title: string, body?: string, data?: Record<string,string> }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!saRaw) throw new Error('FIREBASE_SERVICE_ACCOUNT env not set')
  const sa = JSON.parse(saRaw)

  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return { token: cachedToken.token, projectId: sa.project_id }
  }

  const privateKey = await importPKCS8(sa.private_key, 'RS256')

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json()
  if (!data.access_token) throw new Error('OAuth failed: ' + JSON.stringify(data))

  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  }

  return { token: data.access_token, projectId: sa.project_id }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.includes(serviceKey)) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { user_id, title, body, data } = await req.json()
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id and title required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
    )

    const { data: tokens, error: tokenErr } = await supabase
      .from('device_tokens')
      .select('token')
      .eq('user_id', user_id)

    if (tokenErr) throw tokenErr
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no tokens for user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { token: accessToken, projectId } = await getAccessToken()

    const results: any[] = []
    const stale: string[] = []

    for (const { token } of tokens) {
      const fcmRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body: body || '' },
              data: data || {},
              android: {
                priority: 'HIGH',
                notification: { channel_id: 'default', sound: 'default' },
              },
            },
          }),
        },
      )

      const fcmData = await fcmRes.json()
      results.push({
        token_prefix: token.slice(0, 15) + '...',
        status: fcmRes.status,
        ok: fcmRes.ok,
      })

      if (fcmRes.status === 404) {
        stale.push(token)
      } else if (fcmRes.status === 400 && fcmData?.error?.details) {
        const isUnregistered = fcmData.error.details.some(
          (d: any) => d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT',
        )
        if (isUnregistered) stale.push(token)
      }
    }

    if (stale.length > 0) {
      await supabase.from('device_tokens').delete().in('token', stale)
    }

    return new Response(JSON.stringify({
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      stale_cleaned: stale.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('send-push error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
