export type ProblemType = 'abnormal' | 'suggestion' | 'other'

export interface OpsFeedbackItem {
  id: string
  problemType: ProblemType
  content: string
  contact?: string
  images: string[]
  createdAt: string
}

const TYPE_LABEL: Record<ProblemType, string> = {
  abnormal: '功能异常',
  suggestion: '意见与建议',
  other: '其他',
}

export function problemTypeLabel(type: ProblemType): string {
  return TYPE_LABEL[type] ?? type
}

export async function fetchOpsFeedbacks(): Promise<OpsFeedbackItem[]> {
  const res = await fetch('/api/ops/feedbacks')
  if (!res.ok) {
    throw new Error(`加载失败(${res.status})`)
  }
  const data = (await res.json()) as { list: OpsFeedbackItem[] }
  return Array.isArray(data.list) ? data.list : []
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
