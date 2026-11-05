from dataclasses import dataclass


@dataclass(frozen=True)
class Topic:
    title: str
    tags: tuple[str, ...]
    problem: str
    code: str
    answers: tuple[str, ...]
    comments: tuple[str, ...]


TOPICS = (
    Topic(
        "Prevent stale search results from replacing a newer React query",
        ("react", "typescript", "async"),
        "Typing quickly sends several requests. A slower response sometimes replaces the results for the current search term. Debouncing reduces traffic but does not fix the ordering.",
        "useEffect(() => {\n  fetch(`/api/search?q=${encodeURIComponent(query)}`)\n    .then(r => r.json()).then(setResults);\n}, [query]);",
        (
            "Create an AbortController inside the effect, pass its signal to fetch, and abort it in the cleanup. Catch AbortError separately so cancelled searches do not show an error banner. This ties each request to the render that created it.",
            "Keep a request sequence in a ref. Increment it before each fetch and only update state if the completed request still has the latest sequence. This also works with clients that cannot cancel network requests.",
            "Use a query cache keyed by the normalized search term. Render data for the active key and keep previous data only as an explicit loading state. Still handle cancellation: debouncing alone does not guarantee response order.",
        ),
        ("Does the cleanup also run when the component unmounts?", "The sequence guard fixed this in our slow-network test. We also stopped treating AbortError as a failure."),
    ),
    Topic(
        "Choose a stable cursor for a PostgreSQL activity feed",
        ("postgresql", "pagination", "sql"),
        "Our feed uses OFFSET and becomes slow on later pages. New rows arriving between requests also cause duplicate items. Several rows can have the same creation timestamp.",
        "SELECT id, created_at FROM activities\nORDER BY created_at DESC, id DESC\nLIMIT 25 OFFSET 10000;",
        (
            "Use keyset pagination with both created_at and id in the cursor. For descending order, filter with (created_at, id) < (:time, :id), then keep the same ORDER BY. A timestamp alone is not unique enough.",
            "Add a composite index matching the filter and ordering. If the feed is scoped to a workspace, put workspace_id first, followed by created_at DESC and id DESC. Check EXPLAIN ANALYZE on a representative late page.",
            "Serialize the timestamp without losing precision and validate cursor fields on the server. Fetch limit + 1 rows to determine whether another page exists. Avoid a full COUNT query on every navigation.",
        ),
        ("Including id resolved the duplicate timestamps in my fixture.", "How should the cursor behave if the last item on the page is deleted?"),
    ),
    Topic(
        "Avoid N+1 queries when serializing SQLAlchemy relationships",
        ("python", "sqlalchemy", "performance"),
        "The endpoint returns questions with authors and comments. Query count grows with every additional question, and asynchronous serialization occasionally attempts a lazy database load.",
        "rows = await session.scalars(select(Question))\nreturn [{\"author\": q.author.username} for q in rows]",
        (
            "Load the required relationships explicitly using selectinload. It issues a bounded number of queries for a collection and avoids surprise IO during response serialization. Keep the session alive while constructing the response.",
            "Use joinedload for a small many-to-one relationship such as author, and selectinload for larger collections. A joined collection multiplies rows, so remember Result.unique() when that strategy is appropriate.",
            "Measure query counts with SQL logging on a populated database. Add a test that reads multiple parents so an N+1 regression cannot hide behind a one-row fixture. Only load fields that the response actually needs.",
        ),
        ("selectinload removed the MissingGreenlet error during serialization.", "Would a projection query be simpler for this read-only endpoint?"),
    ),
    Topic(
        "Keep an accessible dialog usable with keyboard navigation",
        ("accessibility", "react", "html"),
        "The modal looks correct but keyboard focus moves behind the overlay. After closing it, users lose their place in the page. We also need a useful screen-reader announcement.",
        '<div role="dialog" aria-modal="true">\n  <h2>Update profile</h2>\n  <input aria-label="Display name" />\n</div>',
        (
            "Move focus into the dialog on open, constrain tab navigation while it is active, and restore focus to the triggering control on close. Give the dialog an accessible name via aria-labelledby and support Escape consistently.",
            "Consider the native dialog element with showModal(). It provides modal focus behavior and makes the rest of the document inert. Test your supported browser and assistive-technology combinations before relying on defaults.",
            "Use a well-tested dialog primitive if you need nested portals or complex focus management. Keep the close button in the tab order and avoid setting initial focus on destructive actions.",
        ),
        ("Returning focus to the trigger made the flow much easier to follow.", "What should happen if the element that opened the modal has been removed?"),
    ),
    Topic(
        "Handle timezone boundaries when grouping daily activity",
        ("python", "datetime", "postgresql"),
        "An activity chart is off by one day for some users. Timestamps are stored in UTC, but the UI groups them after converting only the label. Daylight saving transitions make a fixed offset unreliable.",
        "day = event.created_at.date()\ncounts[day] += 1",
        (
            "Convert each timestamp into the user's IANA timezone before extracting the local date. Use zoneinfo rather than a fixed offset, because offsets vary by date. Keep storage and transport timestamps in UTC.",
            "For database aggregation, group using the intended timezone and filter using UTC bounds derived from local midnight. The UTC duration of a local day is not always twenty-four hours.",
            "Test both daylight saving transitions, timestamps near midnight, and a timezone with a non-whole-hour offset. Make the reporting timezone visible so exported results have an unambiguous interpretation.",
        ),
        ("The twenty-three-hour day was the missing case in our tests.", "Do you recommend storing the user's reporting timezone with each saved report?"),
    ),
    Topic(
        "Make retried payment webhooks idempotent",
        ("api", "postgresql", "transactions"),
        "Our webhook provider retries after a timeout. Two workers can receive the same event at once, and checking whether it exists before inserting has caused duplicate fulfillment records.",
        "if not await event_exists(event_id):\n    await fulfill_order(order_id)\n    await save_event(event_id)",
        (
            "Enforce a unique provider event ID in the database. Claim it and apply the state change in one transaction. A check followed by an insert is not sufficient because concurrent workers can both pass the check.",
            "Use an outbox row in the same transaction for external work. A separate worker delivers the side effect with its own idempotency key. Holding a database transaction open during a remote call still cannot make that remote call atomic.",
            "Verify the webhook signature against the original bytes before parsing, and return success for an already processed event. Test concurrent duplicate deliveries and a failure immediately before commit.",
        ),
        ("The unique constraint caught the race that our in-memory lock missed.", "How do you recover an event that was claimed but never committed?"),
    ),
    Topic(
        "Explain a slow PostgreSQL query that ignores an index",
        ("postgresql", "indexes", "performance"),
        "We added an index, but the planner still chooses a sequential scan. The filter matches a large share of the table in development and only a small share in production.",
        "EXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM events WHERE workspace_id = 42;",
        (
            "A sequential scan can be cheaper when the filter selects much of the table. Inspect estimated versus actual row counts and buffer reads before trying to force an index. Use a realistic data distribution.",
            "Run ANALYZE after loading a large fixture. Check whether correlated columns need extended statistics and whether casts or expressions prevent the predicate from matching the index.",
            "Measure the whole query, including sorting and selected columns. A composite or partial index can help a frequent selective query, but every extra index adds write and maintenance cost.",
        ),
        ("Refreshing statistics changed the estimate from a few rows to thousands.", "Would an index-only scan still need heap access after a large batch insert?"),
    ),
    Topic(
        "Prevent duplicate jobs when several workers claim a queue",
        ("postgresql", "workers", "concurrency"),
        "Each worker selects the oldest pending job and marks it running in a separate statement. Under load, two workers sometimes process the same job.",
        "SELECT id FROM jobs WHERE status = 'pending'\nORDER BY created_at LIMIT 1;",
        (
            "Claim jobs within a transaction using FOR UPDATE SKIP LOCKED, then update their status before committing. This lets workers claim different rows without waiting on the same oldest job.",
            "Add a lease expiration and a retry count so a crashed worker does not strand a job forever. Keep handlers idempotent because a lease can expire while a slow worker is still completing its work.",
            "Keep claim transactions short and do the expensive work after the claim commits. Index the pending-job selection and test recovery after a worker dies between claim and acknowledgment.",
        ),
        ("We added a lease timeout and now recover jobs after deployment.", "How do you prevent a late worker from acknowledging a newer lease?"),
    ),
    Topic(
        "Stream a large CSV export without holding every row in memory",
        ("python", "fastapi", "streaming"),
        "The export endpoint builds a list of every result and then creates one giant string. Memory use grows sharply for larger workspaces, and clients wait a long time for the first byte.",
        "rows = (await session.execute(query)).all()\nreturn make_csv(rows)",
        (
            "Iterate over database results in bounded batches and yield encoded CSV chunks through StreamingResponse. Use the csv module for quoting; joining fields with commas corrupts embedded commas and newlines.",
            "Keep the database session open for the lifetime of the response generator and close it on cancellation. Decide whether the export needs a consistent snapshot and document the transaction cost of a long export.",
            "For very large exports, enqueue a background job and offer a download after completion. Bound the export size, handle spreadsheet formula injection in user-controlled cells, and test client disconnections.",
        ),
        ("A cancelled download was leaving a connection checked out in our implementation.", "We now include fields containing quotes and newlines in the export tests."),
    ),
    Topic(
        "Model TypeScript API errors without unsafe type assertions",
        ("typescript", "api", "validation"),
        "Our client casts response.json() to the expected success type even for errors. Components then crash on missing fields. We want callers to handle authentication and validation failures explicitly.",
        "const payload = await response.json() as User;\nreturn payload.username;",
        (
            "Treat decoded JSON as unknown until it is validated. Check the HTTP status and parse the success or error shape with runtime validation. Type assertions alone provide no validation of network data.",
            "Return a discriminated union such as {ok: true, data} or {ok: false, error}. Switching on ok gives callers safe narrowing and makes the expected failure path visible in their types.",
            "Handle empty bodies and non-JSON failures at the transport layer. Preserve the status and a useful message without assuming an upstream proxy returns your application's error schema.",
        ),
        ("The empty 204 response was another case our JSON parser missed.", "Would you keep transport errors separate from field validation errors?"),
    ),
    Topic(
        "Use CSS grid without overflowing narrow cards",
        ("css", "responsive-design", "html"),
        "The layout fits on desktop, but a long URL in one card forces the entire grid wider than the viewport. Setting width to 100% on the card has not solved it.",
        ".grid { display: grid; grid-template-columns: 1fr 1fr; }",
        (
            "Use minmax(0, 1fr) for flexible tracks and min-width: 0 on grid children that need to shrink. The default minimum content size can otherwise force the track wider than the viewport.",
            "Apply overflow-wrap: anywhere to unbroken user text such as URLs, and constrain images with max-width: 100%. Keep code blocks horizontally scrollable instead of wrapping syntax unexpectedly.",
            "Test with long tokens, translated labels, and larger system fonts. A repeat(auto-fit, minmax(min(100%, 18rem), 1fr)) layout can collapse naturally without forcing a fixed number of columns.",
        ),
        ("min-width: 0 was the missing rule on the nested flex child.", "The long-URL fixture reproduced this much more reliably than resizing alone."),
    ),
    Topic(
        "Invalidate a cached profile after an edit",
        ("caching", "react", "api"),
        "Saving the settings form updates the database, but the header still shows the old display name. We have separate requests for the profile page and the current-user menu.",
        "await api.put('/users/me', form);\nnavigate('/profile');",
        (
            "Identify every cache key that contains the edited profile. Update the current-user cache from the mutation response and invalidate other dependent queries so they refetch when needed.",
            "Keep a single authoritative current-user state instead of copying it into unrelated component state. Derive the header from that source and keep temporary form edits separate until saving succeeds.",
            "If using optimistic updates, retain the previous cache value and restore it on failure. Revalidate after the request finishes so server normalization and concurrent edits are reflected.",
        ),
        ("Updating only the profile query left the navigation menu stale.", "How should an optimistic update behave if two tabs edit the profile?"),
    ),
    Topic(
        "Add a required column without blocking a busy table",
        ("postgresql", "alembic", "migrations"),
        "A migration adds a non-null field to an existing table with many rows. Old application instances continue writing during deployment, so a single schema-and-code switch is difficult.",
        "op.add_column('documents', sa.Column('category', sa.Text(), nullable=False))",
        (
            "Use an expand-and-contract rollout: add a compatible nullable column, deploy writers that populate it, backfill existing rows in batches, and only then enforce the required constraint.",
            "Choose a temporary default only if it has a valid domain meaning. Test the migration against a populated copy and set a lock timeout so deployment does not unexpectedly wait behind a long transaction.",
            "Track backfill progress and validate that no nulls remain before tightening the constraint. Keep old readers and writers compatible until all deployed instances have moved to the new version.",
        ),
        ("The empty development database hid the problem until staging.", "Should the backfill be a separate operational job rather than part of the migration?"),
    ),
    Topic(
        "Cancel asynchronous work when a client disconnects",
        ("python", "asyncio", "fastapi"),
        "A streaming endpoint continues generating output after the browser closes. It holds a database connection and spends time on results that no one will read.",
        "async def stream():\n    async for item in producer():\n        yield item",
        (
            "Use try/finally around resource acquisition inside the generator and let cancellation propagate. Do not swallow CancelledError in a broad exception handler or start untracked tasks that outlive the response.",
            "If the upstream SDK has a close or cancel operation, call it from the cleanup path. Bound network timeouts as well, since cancellation support varies between clients.",
            "Test a disconnect after the first chunk and assert that resources are returned to the pool. Long-running work that should survive the request belongs in a separately managed job queue.",
        ),
        ("Our broad exception handler was turning cancellation into a retry.", "Is cleanup still guaranteed if cancellation arrives during an awaited close?"),
    ),
    Topic(
        "Test secure session cookies through a local HTTPS proxy",
        ("authentication", "https", "testing"),
        "Login succeeds in the API response but subsequent browser requests are anonymous. The session cookie is marked Secure, while the development frontend is served over plain HTTP.",
        'response.set_cookie("session", token, secure=True, httponly=True, samesite="lax")',
        (
            "Serve the local frontend over HTTPS and proxy API requests through the same origin. Trust the development certificate explicitly in your test client instead of disabling certificate verification.",
            "Inspect the cookie's path, domain, SameSite policy, and the actual request origin. Cross-origin fetch calls also need credentials: include and a matching credentialed CORS policy.",
            "Use an HTTPS base URL in in-process HTTP tests so Secure cookie behavior matches deployment. Check a second authenticated request after login; a successful login response alone is not a session test.",
        ),
        ("Checking the next request revealed that the cookie was never being sent.", "Should the proxy preserve the original Host header in this setup?"),
    ),
    Topic(
        "Preserve scroll position while loading older messages",
        ("react", "ui", "pagination"),
        "Prepending an older page to a chat conversation jumps the viewport to a different message. Automatically scrolling to the bottom also interrupts users who are reading history.",
        "setMessages(previous => [...olderPage, ...previous]);",
        (
            "Record a visible message ID and its offset before prepending. After layout, find the same element and adjust scrollTop by the offset difference. Stable message keys are essential.",
            "Only follow new messages when the reader is already close to the bottom. Otherwise show a new-message indicator and let them choose when to jump back to the latest message.",
            "Account for images or fonts changing height after the initial render. A virtualized list with explicit anchor support can make this more reliable for long conversations.",
        ),
        ("Index-based React keys were making the anchor move to another row.", "How do you preserve the anchor when an image loads later?"),
    ),
    Topic(
        "Avoid flaky async tests that share database connections",
        ("pytest", "asyncio", "sqlalchemy"),
        "Tests pass independently but fail together with event-loop errors. The application uses an async connection pool while fixtures create a fresh event loop for each test.",
        "engine = create_async_engine(database_url)\n# reused by fixtures with different event-loop lifetimes",
        (
            "Align the engine and event-loop fixture lifetimes. A pooled connection created on one loop should not be reused on another. Dispose the engine before its owning loop closes.",
            "For an isolated integration-test harness, NullPool avoids reusing connections across test loops. Use a dedicated disposable database and build the real schema with migrations before testing.",
            "Avoid global clients with hidden connection pools unless their lifecycle matches the test session. Add cleanup in fixture finalizers and verify that the full suite runs, not just individual tests.",
        ),
        ("NullPool fixed the loop mismatch while we simplified fixture scopes.", "Would a session-scoped event loop also require session-scoped clients?"),
    ),
    Topic(
        "Keep uploaded images within resource limits",
        ("python", "uploads", "images"),
        "Checking Content-Type and compressed file size is not enough for our avatar endpoint. A small file can decode into a huge image, and filenames may not reflect the real format.",
        "if upload.content_type == 'image/png':\n    image = Image.open(upload.file)",
        (
            "Validate the decoded format and pixel dimensions as well as the input byte limit. Treat decompression-bomb warnings as failures and reject unsupported formats before processing the image.",
            "Re-encode accepted images to a controlled format and generate your own storage name. Do not construct filesystem paths from the original filename, and strip metadata that you do not need.",
            "Bound processing time and concurrent image work, then store the result outside application source directories. Test malformed images, oversized dimensions, and uploads with a misleading content type.",
        ),
        ("Our tiny compressed fixture expanded beyond the pixel limit.", "Do you normalize EXIF orientation before generating the thumbnail?"),
    ),
    Topic(
        "Make Docker startup wait for a usable database",
        ("docker", "postgresql", "devops"),
        "The API container starts before PostgreSQL accepts connections. A fixed sleep works on one laptop but fails on a cold volume or a slower CI worker.",
        "depends_on:\n  - db",
        (
            "Define a PostgreSQL healthcheck and use the service_healthy dependency condition. Container creation order alone does not mean the database is accepting connections.",
            "Add bounded connection retries in the application startup path and run migrations before starting the server. Log the failing prerequisite so a missing password is not confused with a slow startup.",
            "Expose an application health endpoint that executes a small database query. Waiting for a TCP port only proves that something is listening, not that credentials and schema are usable.",
        ),
        ("The healthcheck removed the laptop-specific sleep from our scripts.", "How should migration failures affect the container restart policy?"),
    ),
    Topic(
        "Coalesce vote notifications without losing unread counts",
        ("postgresql", "notifications", "concurrency"),
        "A popular answer can generate hundreds of near-identical notifications. We want one unread item with an actor count, but simultaneous votes currently create duplicate inbox rows.",
        "existing = await find_unread(recipient, key)\nif existing:\n    existing.actor_count += 1",
        (
            "Use a partial unique index on recipient and coalesce key for unread rows. Insert with ON CONFLICT DO UPDATE so concurrent votes increment the actor count atomically.",
            "Keep the latest actor and timestamp on the aggregated row, and create a fresh row after the previous notification is read. Do not merge unrelated subjects just because they share an event type.",
            "Suppress self-notifications and emit only when a vote is first created. Vote changes or removals need an explicit product rule so toggling a vote does not repeatedly notify the author.",
        ),
        ("The partial index lets us retain read history while coalescing new activity.", "Should actor_count represent distinct voters or every event?"),
    ),
)

FIRST_NAMES = ("Amira", "Youssef", "Sofia", "Daniel", "Leila", "Omar", "Maya", "Noah", "Amina", "Lucas", "Priya", "Kenji", "Fatima", "Elias", "Zoe", "Mateo", "Nadia", "Ibrahim", "Lina", "Samir", "Chloe", "Arjun", "Hana", "Felix", "Ines", "Adam", "Salma", "Ravi", "Sara", "Theo")
LAST_NAMES = ("Benali", "Martin", "Patel", "Garcia", "Tanaka", "Haddad", "Nguyen", "Silva", "Khan", "Rossi", "Diallo", "Chen", "Costa", "Wilson", "Bennett", "Rahman", "Kim", "Ivanova", "Mensah", "Dubois")
CITIES = ("Casablanca", "Lisbon", "Nairobi", "Berlin", "Montreal", "Tokyo", "Bengaluru", "Dakar", "Amsterdam", "Tunis", "Sao Paulo", "Paris")
ROLES = ("backend developer", "frontend engineer", "computer science student", "platform engineer", "technical writer", "product engineer", "data engineer", "open-source maintainer")
PROJECTS = ("community library", "volunteer scheduling app", "research notebook", "campus forum", "team knowledge base", "local events directory", "equipment booking tool", "language learning platform", "recipe exchange", "inventory dashboard", "study group planner", "public transport tracker", "support portal", "reading club", "garden sharing app", "workshop registration site", "museum archive", "sports league portal", "travel journal", "community newsletter")
CONSTRAINTS = (
    "The service runs in two containers and we need the behavior to survive a rolling restart.",
    "We support mobile connections, so intermittent latency is part of the normal workload.",
    "The dataset is small today, but we expect it to grow by an order of magnitude this year.",
    "We need to preserve the existing API response format while introducing the change.",
    "Several people can edit the same workspace and we want concurrent requests to remain consistent.",
    "Our integration tests use PostgreSQL and should reproduce the production behavior.",
)
DISCUSSION = (
    "Could you share which edge cases you would cover before shipping this?",
    "I would appreciate a minimal approach and a way to verify that it works under load.",
    "What tradeoffs should we consider before choosing an implementation?",
    "Is there a reliable way to reproduce this in an integration test?",
)
CONVERSATION = (
    "Hi {name}, I read your answer about {topic}. Would you have a moment to compare notes?",
    "Sure! We ran into that in our {project}. Which part is giving you trouble?",
    "The basic case works now. I am adding a regression test for the edge case you mentioned.",
    "Good idea. Keep the fixture small enough that the failure is easy to understand.",
    "I tried that and the test now reproduces it consistently. The explanation was very helpful.",
    "Happy to help. Could you post the result on the question so the next person can find it?",
    "Done. I added the constraints and the verification steps to the follow-up comment.",
    "Thanks! I will take a look after our study group session this afternoon.",
)
