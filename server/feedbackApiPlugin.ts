import type { Plugin } from 'vite'
import {
  handleCreateFeedback,
  handleListFeedbacks,
  handleUploadFile,
} from './feedbackStore'

export function feedbackApiPlugin(): Plugin {
  return {
    name: 'app-h5-feedback-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''

        if (req.method === 'POST' && url === '/api/feedback') {
          void handleCreateFeedback(req, res)
          return
        }

        if (req.method === 'GET' && url === '/api/ops/feedbacks') {
          handleListFeedbacks(res)
          return
        }

        const uploadMatch = url.match(/^\/api\/ops\/uploads\/([^/]+)$/)
        if (req.method === 'GET' && uploadMatch) {
          handleUploadFile(res, decodeURIComponent(uploadMatch[1]))
          return
        }

        next()
      })
    },
  }
}
