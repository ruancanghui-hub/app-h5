import { request } from './http'

export type ProblemType = 'abnormal' | 'suggestion' | 'other'

export interface FeedbackPayload {
  problemType: ProblemType
  content: string
  contact?: string
  images: File[]
}

export interface FeedbackResult {
  id: string
  createdAt: string
}

export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
  const form = new FormData()
  form.append('problemType', payload.problemType)
  form.append('content', payload.content)
  if (payload.contact) form.append('contact', payload.contact)
  payload.images.forEach((file, index) => {
    form.append('images', file, file.name || `image-${index}.jpg`)
  })

  return request<FeedbackResult>('/feedback', {
    method: 'POST',
    formData: form,
    retryable: false,
  })
}
