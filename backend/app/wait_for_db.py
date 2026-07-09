import asyncio
import sys
from sqlalchemy import text
from app.db.session import engine

async def wait(retries: int = 30, delay: float = 2.0) -> None:
    for attempt in range(1, retries + 1):
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            print("Database is ready.")
            await engine.dispose()
            return
        except Exception as exc:
            print(f"Database not ready (attempt {attempt/{retries}}: {exc})")
            await asyncio.sleep(delay)
    print("Database did not become ready in time.", file=sys.stderr)
    await engine.dispose()
    sys.exit(1)

if __name__ == "__main__":
    asyncio.run(wait())