import asyncio
import json

import httpx
import pytest

from app.services import llm


@pytest.fixture(autouse=True)
def provider_config(monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "test-secret-key")
    monkeypatch.setattr(llm.settings, "LLM_PROVIDER", "openai")
    monkeypatch.setattr(llm.settings, "LLM_MODEL", "test-model")


@pytest.fixture
def mock_provider(monkeypatch):
    client_class = httpx.AsyncClient
    def install(handler):
        transport = httpx.MockTransport(handler)
        monkeypatch.setattr(llm.httpx, "AsyncClient", lambda **kwargs:
                            client_class(transport=transport, **kwargs))
    return install


class Stream(httpx.AsyncByteStream):
    def __init__(self, chunks, failure=None):
        self.chunks = chunks
        self.failure = failure
        self.closed = False
        self.read_count = 0

    async def __aiter__(self):
        for chunk in self.chunks:
            self.read_count += 1
            yield chunk
        if self.failure is not None:
            raise self.failure

    async def aclose(self):
        self.closed = True


def token(text):
    return ("data: " + json.dumps({"choices": [{"delta": {"content": text}}]}) + "\n\n").encode()


async def test_progressive_tokens_payload_snapshot_and_done(mock_provider, monkeypatch):
    stream = Stream([token("Hel"), token("lo"), b"data: [DONE]\n\n", token("ignored")])
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(200, stream=stream)
    mock_provider(respond)
    messages = [llm.ChatMessage("system", "Be helpful"), llm.ChatMessage("user", "Hi")]
    reply = llm.chat_stream(messages)
    assert not requests
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "changed-key")
    monkeypatch.setattr(llm.settings, "LLM_MODEL", "changed-model")
    assert await anext(reply) == "Hel"
    assert stream.read_count == 1 and not stream.closed
    assert await anext(reply) == "lo"
    with pytest.raises(StopAsyncIteration):
        await anext(reply)
    assert stream.closed and stream.read_count == 3
    request = requests[0]
    assert str(request.url) == llm.CHAT_COMPLETIONS_URL
    assert request.method == "POST"
    assert request.headers["Authorization"] == "Bearer test-secret-key"
    assert json.loads(request.content) == {
        "model": "test-model", "stream": True,
        "messages": [{"role": "system", "content": "Be helpful"}, {"role": "user", "content": "Hi"}],
    }
    assert request.extensions["timeout"]["read"] >= 120


async def test_fragmented_utf8_crlf_multiline_and_metadata(mock_provider):
    body = (
        ': keepalive\r\nevent: message\r\n'
        'data: {"choices": [\r\n'
        'data: {"delta": {"role": "assistant"}}]}\r\n\r\n'
        'data: {"choices": [{"delta": {"content": "été"}}]}\r\n\r\n'
        'data: {"choices": [{"delta": {"content": null}, "finish_reason": "stop"}]}\n\n'
        'data: {"choices": [], "usage": {"total_tokens": 3}}\n\n'
        'data: [DONE]\n\n'
    ).encode()
    stream = Stream([body[index:index + 1] for index in range(len(body))])
    mock_provider(lambda request: httpx.Response(200, stream=stream))
    assert [part async for part in llm.chat_stream([llm.ChatMessage("user", "Hi")])] == ["été"]
    assert stream.closed


@pytest.mark.parametrize("status,error", [
    (429, llm.LLMRateLimited), (400, llm.LLMUnavailable),
    (401, llm.LLMUnavailable), (500, llm.LLMUnavailable),
])
async def test_http_errors_are_lazy_and_sanitized(mock_provider, caplog, status, error):
    stream = Stream([b"test-secret-key upstream response body"])
    mock_provider(lambda request: httpx.Response(status, stream=stream))
    reply = llm.chat_stream([llm.ChatMessage("user", "Hi")])
    with pytest.raises(error) as failure:
        await anext(reply)
    assert "test-secret-key" not in str(failure.value)
    assert "upstream response body" not in str(failure.value)
    assert "test-secret-key" not in caplog.text
    assert stream.closed and stream.read_count == 0


@pytest.mark.parametrize("failure,error", [
    (httpx.ConnectTimeout("test-secret-key"), llm.LLMTimeout),
    (httpx.ReadTimeout("test-secret-key"), llm.LLMTimeout),
    (httpx.ConnectError("test-secret-key"), llm.LLMUnavailable),
])
async def test_connect_failures_are_sanitized(mock_provider, failure, error):
    def respond(request):
        raise failure
    mock_provider(respond)
    reply = llm.chat_stream([llm.ChatMessage("user", "Hi")])
    with pytest.raises(error) as caught:
        await anext(reply)
    assert "test-secret-key" not in str(caught.value)
    assert caught.value.__suppress_context__


async def test_midstream_timeout_preserves_delivered_tokens_and_closes(mock_provider):
    stream = Stream([token("partial")], failure=httpx.ReadTimeout("test-secret-key"))
    mock_provider(lambda request: httpx.Response(200, stream=stream))
    reply = llm.chat_stream([llm.ChatMessage("user", "Hi")])
    assert await anext(reply) == "partial"
    with pytest.raises(llm.LLMTimeout):
        await anext(reply)
    assert stream.closed


@pytest.mark.parametrize("data", [
    b'data: test-secret-key\n\n',
    b'data: {"error": {"message": "test-secret-key"}}\n\n',
    b'data: {"choices": [{"delta": {"content": 42}}]}\n\n',
    b'data: {"unexpected": "test-secret-key"}\n\n',
])
async def test_invalid_events_are_sanitized(mock_provider, data):
    stream = Stream([data])
    mock_provider(lambda request: httpx.Response(200, stream=stream))
    with pytest.raises(llm.LLMUnavailable) as failure:
        await anext(llm.chat_stream([llm.ChatMessage("user", "Hi")]))
    assert "test-secret-key" not in str(failure.value)
    assert stream.closed


async def test_truncated_stream_raises_instead_of_silently_finishing(mock_provider):
    stream = Stream([token("partial")])
    mock_provider(lambda request: httpx.Response(200, stream=stream))
    reply = llm.chat_stream([llm.ChatMessage("user", "Hi")])
    assert await anext(reply) == "partial"
    with pytest.raises(llm.LLMUnavailable):
        await anext(reply)
    assert stream.closed


async def test_closing_iterator_closes_upstream(mock_provider):
    stream = Stream([token("first"), token("second"), b"data: [DONE]\n\n"])
    mock_provider(lambda request: httpx.Response(200, stream=stream))
    reply = llm.chat_stream([llm.ChatMessage("user", "Hi")])
    assert await anext(reply) == "first"
    await reply.aclose()
    assert stream.closed and stream.read_count == 1


async def test_cancelled_read_closes_upstream(mock_provider):
    waiting = asyncio.Event()
    class WaitingStream(Stream):
        async def __aiter__(self):
            yield token("first")
            waiting.set()
            await asyncio.Event().wait()
    stream = WaitingStream([])
    mock_provider(lambda request: httpx.Response(200, stream=stream))
    reply = llm.chat_stream([llm.ChatMessage("user", "Hi")])
    assert await anext(reply) == "first"
    task = asyncio.create_task(anext(reply))
    await asyncio.wait_for(waiting.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert stream.closed


async def test_add_provider_without_changing_callers(monkeypatch):
    async def other_provider(messages):
        yield messages[0].content
    monkeypatch.setitem(llm.PROVIDERS, "other", other_provider)
    monkeypatch.setattr(llm.settings, "LLM_PROVIDER", "other")
    assert [part async for part in llm.chat_stream([llm.ChatMessage("user", "Hi")])] == ["Hi"]


def test_blank_key_fails_before_network(monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "  ")
    with pytest.raises(llm.LLMUnavailable):
        llm.chat_stream([llm.ChatMessage("user", "Hi")])
