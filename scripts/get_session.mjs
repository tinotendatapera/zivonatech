import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.TEST_AUTH_EMAIL || 'tynoetapera@gmail.com'
const password = process.env.TEST_AUTH_PASSWORD || '12345678'

if (!url || !anon) {
  console.error('Missing env NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(2)
}

const supabase = createClient(url, anon)

async function run() {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('SIGNIN_ERROR', error.message || error.toString())
      process.exit(3)
    }
    console.log(JSON.stringify(data.session || data, null, 2))
  } catch (err) {
    console.error('ERR', String(err))
    process.exit(4)
  }
}

run()
