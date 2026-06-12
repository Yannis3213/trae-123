/// <reference types="vinxi/types/client" />
import { hydrateRoot } from 'react-dom/client'
import { createStartClient } from '@tanstack/react-start/client'

const client = createStartClient()

try {
  hydrateRoot(document, <client.StartRouter />)
} catch (err) {
  console.error('Failed to hydrate:', err)
  window.location.reload()
}
