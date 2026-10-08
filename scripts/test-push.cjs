const fs = require('fs')
const jwt = require('jsonwebtoken')

const SA_PATH = process.argv[2]
const DEVICE_TOKEN = process.argv[3]

if (!SA_PATH || !DEVICE_TOKEN) {
  console.error('Usage: node scripts/test-push.js <sa.json> <device-token>')
  process.exit(1)
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const signed = jwt.sign(payload, sa.private_key, { algorithm: 'RS256' })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signed,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Token failed: ' + JSON.stringify(data))
  return data.access_token
}

async function sendPush(projectId, accessToken, deviceToken) {
  const body = {
    message: {
      token: deviceToken,
      notification: {
        title: 'Nakubonye test push',
        body: 'If you see this, push notifications are working!',
      },
      android: {
        priority: 'HIGH',
        notification: {
          channel_id: 'default',
          sound: 'default',
        },
      },
    },
  }
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  const data = await res.json()
  return { status: res.status, data }
}

async function main() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))
  console.log('Project:', sa.project_id)
  console.log('Sender :', sa.client_email)

  console.log('\n[1/3] Minting OAuth token...')
  const accessToken = await getAccessToken(sa)
  console.log('      got token (len ' + accessToken.length + ')')

  console.log('\n[2/3] Sending FCM message...')

  console.log('\n[3/3] FCM response:')
  const result = await sendPush(sa.project_id, accessToken, DEVICE_TOKEN)
  console.log('      HTTP', result.status)
  console.log('      ' + JSON.stringify(result.data))
}

main().catch(e => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
