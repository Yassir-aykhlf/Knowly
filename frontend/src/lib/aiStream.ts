export async function readAiStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false

  function consume() {
    buffer = buffer.replace(/\r\n/g, '\n')
    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      let event = 'message'
      const data: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
      }
      if (!data.length) continue
      const payload = JSON.parse(data.join('\n')) as { delta?: unknown; message?: unknown }
      if (event === 'error') {
        throw new Error(typeof payload.message === 'string' ? payload.message : 'The assistant is unavailable. Please try again.')
      }
      if (event === 'done') { done = true; return }
      if (typeof payload.delta === 'string') onDelta(payload.delta)
    }
  }

  try {
    while (!done) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      consume()
      if (chunk.done) {
        if (!done) throw new Error('The assistant connection ended unexpectedly. Please try again.')
        break
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
