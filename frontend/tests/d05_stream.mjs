import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/aiStream.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { readAiStream } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const encoder = new TextEncoder()
function stream(text, size = 1) {
  const bytes = encoder.encode(text)
  let offset = 0
  return new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) { controller.close(); return }
      controller.enqueue(bytes.slice(offset, offset + size))
      offset = Math.min(bytes.length, offset + size)
    },
  })
}
for (const separator of ['\n', '\r\n']) {
  const text = ['data: {"delta": "Hé"}', '', 'data: {"delta": "🙂"}', '', 'event: done', 'data: {}', '', ''].join(separator)
  for (const size of [1, 2, 7, 1024]) {
    let output = ''
    await readAiStream(stream(text, size), (delta) => { output += delta })
    assert.equal(output, 'Hé🙂')
  }
}
let output = ''
await readAiStream(stream(': heartbeat\n\ndata: {"delta":\ndata: "multi"}\n\nevent: done\ndata: {}\n\n'), (delta) => { output += delta })
assert.equal(output, 'multi')
await assert.rejects(readAiStream(stream('event: error\ndata: {"message": "Try again"}\n\n'), () => {}), /Try again/)
await assert.rejects(readAiStream(stream('data: {"delta": "partial"}\n\n'), () => {}), /ended unexpectedly/)
await assert.rejects(readAiStream(stream('data: {bad}\n\n'), () => {}), SyntaxError)
console.log('SSE parsing: fragmented bytes, Unicode, CRLF, multiline data, provider errors and truncated streams passed')
