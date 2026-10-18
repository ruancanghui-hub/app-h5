import type { Plugin } from 'vite'
import { handleIdentityRequest } from './http'

/** 开发态把身份 API 挂到 Vite middleware（与反馈 API 同端口，生产仍独立进程） */
export function identityApiPlugin(): Plugin {
  return {
    name: 'app-h5-identity-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/api/identity')) {
          next()
          return
        }
        void handleIdentityRequest(req, res).then((handled) => {
          if (!handled) next()
        })
      })
    },
  }
}
