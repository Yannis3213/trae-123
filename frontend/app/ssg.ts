import { createStartSsg } from '@tanstack/react-start/ssg'
import { createRouter } from './router'
import { getRouterManifest } from '@tanstack/react-start/router-manifest'

export default createStartSsg({
  createRouter,
  getRouterManifest,
})
