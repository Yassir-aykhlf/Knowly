import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('D05_BASE_URL', 'https://localhost:9445')
fixture = json.loads(Path('/private/tmp/knowly-d05-fixture.json').read_text())
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless=True)
    context = browser.new_context(ignore_https_errors=True)
    context.add_cookies([{'name': 'knowly_session', 'value': fixture['token'], 'url': BASE, 'secure': True}])
    linked = context.request.post(BASE + '/api/ai/conversations', data={'question_id': fixture['question']})
    assert linked.status == 201
    fixture['conversation'] = linked.json()['id']
    for conversation in context.request.get(BASE + '/api/ai/conversations').json():
        if conversation['id'] != fixture['conversation']:
            assert context.request.delete(BASE + '/api/ai/conversations/' + conversation['id']).status == 204
    page = context.new_page()
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('console', lambda message: failures.append(message.text) if message.type in ('error', 'warning') and 'Failed to load resource' not in message.text else None)
    page.on('response', lambda response: failures.append(f'HTTP {response.status} {response.url}') if response.status >= 400 and response.status != 429 else None)
    page.goto(BASE + '/ai')
    expect(page.get_by_role('heading', name='AI assistant', exact=True)).to_be_visible()
    page.get_by_role('button', name='New conversation', exact=True).click()
    expect(page.get_by_label('Your message')).to_be_visible()
    created_url = page.url
    page.get_by_label('Your message').fill('Complete')
    page.get_by_role('button', name='Send', exact=True).click()
    expect(page.get_by_text('Hello', exact=True)).to_be_visible(timeout=5000)
    expect(page.get_by_role('button', name='Stop generating')).to_be_visible()
    expect(page.locator('pre code')).to_have_text('print(1)\n')
    expect(page.get_by_role('button', name='Stop generating')).to_have_count(0, timeout=10000)
    page.get_by_label('Your message').fill('Stop this reply')
    page.get_by_role('button', name='Send', exact=True).click()
    expect(page.get_by_role('button', name='Stop generating')).to_be_visible()
    page.wait_for_timeout(500)
    page.get_by_role('button', name='Stop generating').click()
    expect(page.get_by_role('button', name='Stop generating')).to_have_count(0, timeout=10000)
    saved_text = page.locator('ul').last.inner_text()
    page.reload()
    expect(page.get_by_label('Your message')).to_be_enabled()
    expect(page.locator('ul').last).to_have_text(saved_text, use_inner_text=True)
    page.get_by_label('Your message').fill('error')
    page.get_by_role('button', name='Send', exact=True).click()
    expect(page.get_by_role('alert')).to_contain_text('The assistant is unavailable')
    expect(page.get_by_label('Your message')).to_have_value('error')
    expect(page.get_by_role('button', name='Stop generating')).to_have_count(0)
    assert 'not exposed' not in page.locator('body').inner_text()
    def cap(route):
        route.fulfill(status=429, headers={'Content-Type': 'application/json', 'Retry-After': '2'}, body=json.dumps({'error': {'message': 'Hourly assistant message limit reached'}}))
    page.route('**/api/ai/conversations/*/messages', cap)
    page.get_by_label('Your message').fill('  Keep this unsent text  ')
    page.get_by_role('button', name='Send', exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Hourly limit reached')
    expect(page.get_by_label('Your message')).to_have_value('  Keep this unsent text  ')
    expect(page.get_by_role('button', name='Send', exact=True)).to_be_disabled()
    expect(page.get_by_role('button', name='Send', exact=True)).to_be_enabled(timeout=6000)
    page.unroute('**/api/ai/conversations/*/messages', cap)
    page.goto(BASE + '/ai/' + fixture['conversation'])
    page.get_by_label('Your message').fill('Linked answer')
    page.get_by_role('button', name='Send', exact=True).click()
    page.get_by_role('button', name='Use this as my answer').click(timeout=10000)
    expect(page).to_have_url(BASE + '/questions/' + fixture['question'])
    expect(page.get_by_role('button', name='Post your answer')).to_be_visible()
    assert 'Hello **world**' in page.locator('textarea').last.input_value()
    page.goto(created_url)
    expect(page.get_by_label('Your message')).to_be_visible()
    page.get_by_role('link', name='All conversations').click()
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('listitem').filter(has=page.get_by_role('link', name='Complete', exact=True)).get_by_role('button').click()
    expect(page.get_by_role('link', name='Complete', exact=True)).to_have_count(0)
    page.once('dialog', lambda dialog: dialog.accept())
    page.get_by_role('button', name='Delete Help with: D05 browser question', exact=True).click()
    expect(page.get_by_text('No conversations yet.', exact=False)).to_be_visible()
    assert not failures, failures
    print('Browser through nginx: CRUD, progressive Markdown, Stop + reload, SSE error, 429 countdown, and answer prefill passed')
    browser.close()
