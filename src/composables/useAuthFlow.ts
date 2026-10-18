import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { challengeS256, clearVerifier, loadVerifier, randomVerifier, saveVerifier } from '@/utils/pkce'

const DEFAULT_CLIENT = 'app-h5-preview'
const TICKET_KEY = 'app-h5-login-ticket'

export function useAuthFlow() {
  const route = useRoute()

  const clientId = computed(() => {
    const q = route.query.client_id
    return (typeof q === 'string' && q) || DEFAULT_CLIENT
  })

  const redirectUri = computed(() => {
    const q = route.query.redirect_uri
    return typeof q === 'string' && q ? q : undefined
  })

  const state = computed(() => {
    const q = route.query.state
    return typeof q === 'string' ? q : undefined
  })

  async function ensurePkce(): Promise<{ verifier: string; challenge: string }> {
    let verifier = loadVerifier()
    if (!verifier) {
      verifier = randomVerifier()
      saveVerifier(verifier)
    }
    const challenge = await challengeS256(verifier)
    return { verifier, challenge }
  }

  function saveLoginTicket(ticket: string) {
    sessionStorage.setItem(TICKET_KEY, ticket)
  }

  function loadLoginTicket(): string | null {
    return sessionStorage.getItem(TICKET_KEY)
  }

  function clearLoginTicket() {
    sessionStorage.removeItem(TICKET_KEY)
  }

  function finishPkce() {
    clearVerifier()
    clearLoginTicket()
  }

  return {
    clientId,
    redirectUri,
    state,
    ensurePkce,
    saveLoginTicket,
    loadLoginTicket,
    clearLoginTicket,
    finishPkce,
    loadVerifier,
  }
}
