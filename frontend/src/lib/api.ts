// A thin wrapper around fetch so every call sends the session cookie and parses
// our error envelope the same way. Same-origin in production (nginx proxies /api
// to the backend), so paths are relative.

export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    // Our backend returns { error: { code, message, fields? } }.
    const err = (data && data.error) || {}
    throw new ApiError(
      res.status,
      err.code ?? 'error',
      err.message ?? res.statusText ?? 'Request failed',
      err.fields,
    )
  }
  return data as T
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'include' }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return handle<T>(await fetch(`/api${path}`, init))
}

// Multipart (file uploads). Don't set Content-Type — the browser adds the
// boundary itself.
async function postForm<T>(path: string, formData: FormData): Promise<T> {
  return handle<T>(
    await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }),
  )
}

function uploadForm<T>(
  path: string,
  formData: FormData,
  onProgress: (fraction: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api${path}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.onabort = () => reject(new Error('Upload aborted'))
    xhr.onload = () => {
      let data: any = null
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T)
        return
      }
      const err = (data && data.error) || {}
      reject(new ApiError(
        xhr.status,
        err.code ?? 'error',
        err.message ?? (xhr.status === 413 ? 'File is too large' : 'Upload failed'),
        err.fields,
      ))
    }
    xhr.send(formData)
  })
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  postForm: <T>(path: string, formData: FormData) => postForm<T>(path, formData),
  uploadForm: <T>(path: string, formData: FormData, onProgress: (fraction: number) => void) =>
    uploadForm<T>(path, formData, onProgress),
}
