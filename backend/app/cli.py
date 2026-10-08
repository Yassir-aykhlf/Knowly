import argparse
import asyncio
import sys

from sqlalchemy.exc import SQLAlchemyError

from app.db.session import AsyncSessionLocal, engine
from app.services.admin import promote_to_admin


async def _promote(email: str) -> int:
    try:
        async with AsyncSessionLocal() as db:
            user = await promote_to_admin(db, email)
            if user is None:
                print(f"No such user: {email}", file=sys.stderr)
                return 1
            await db.commit()
            print(f"{user.email} is now an admin.")
            return 0
    except SQLAlchemyError:
        print("Could not promote user. Check the database connection.", file=sys.stderr)
        return 1
    finally:
        await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    promote = commands.add_parser("promote-admin", help="Promote an existing account to admin")
    promote.add_argument("email")
    args = parser.parse_args()
    return asyncio.run(_promote(args.email))


if __name__ == "__main__":
    raise SystemExit(main())
