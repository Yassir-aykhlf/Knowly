from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
import os
from pathlib import Path
import random
import re
import sys
from uuid import NAMESPACE_URL, UUID, uuid5

from dotenv import load_dotenv
from sqlalchemy import bindparam, insert, select, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.models.answer import Answer
from app.models.comment import Comment
from app.models.friendship import Friendship
from app.models.message import Message
from app.models.notification import Notification
from app.models.question import Question
from app.models.user import User
from app.models.vote import Vote
from app.seed_data import (
    CITIES, CONSTRAINTS, CONVERSATION, DISCUSSION, FIRST_NAMES, LAST_NAMES,
    PROJECTS, ROLES, TOPICS,
)
from app.services.security import hash_password


DEFAULT_PASSWORD = "KnowlyDemo123!"
MODELS = (User, Question, Answer, Comment, Vote, Friendship, Message, Notification)
BATCH_SIZE = 500


@dataclass(frozen=True)
class SeedOptions:
    dataset: str = "demo"
    random_seed: int = 42
    users: int = 250
    questions: int = 1200
    answers: int = 3600
    comments: int = 7200
    votes: int = 18000
    friendships: int = 1200
    messages: int = 6000

    def validate(self) -> None:
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,9}", self.dataset):
            raise ValueError("dataset must be 1–10 lowercase letters, digits or underscores, starting with a letter")
        if self.users < 3 or self.questions < 1:
            raise ValueError("at least 3 users and 1 question are required")
        for name in ("answers", "comments", "votes", "friendships", "messages"):
            if getattr(self, name) < 0:
                raise ValueError(f"{name} must not be negative")
        if self.friendships > self.users * (self.users - 1) // 2:
            raise ValueError("friendships exceeds the number of unique user pairs")
        if self.messages and not self.friendships:
            raise ValueError("messages require at least one friendship")

    @property
    def namespace(self) -> UUID:
        return uuid5(NAMESPACE_URL, f"knowly/development-seed/v1/{self.dataset}")

    def id(self, kind: str, index: int) -> UUID:
        return uuid5(self.namespace, f"{kind}/{index}")


@dataclass
class Corpus:
    rows: dict[str, list[dict]]
    accepted: list[dict]

    @property
    def counts(self) -> dict[str, int]:
        return {name: len(rows) for name, rows in self.rows.items()}


def build_corpus(options: SeedOptions, password: str, now: datetime | None = None) -> Corpus:
    """Build rows without database IO; relationships and IDs are deterministic.

    All timestamps use the schema's naive UTC representation. Passwords are
    hashed once per corpus to keep a large development import inexpensive.
    """
    options.validate()
    if not password or "\0" in password or len(password) > 128:
        raise ValueError("SEED_PASSWORD must contain 1–128 characters and no null bytes")
    now = now or datetime.now(timezone.utc)
    if now.tzinfo:
        now = now.astimezone(timezone.utc).replace(tzinfo=None)
    rng = random.Random(options.random_seed)
    rows: dict[str, list[dict]] = {model.__tablename__: [] for model in MODELS}
    accepted: list[dict] = []

    def add(kind: str, **fields) -> dict:
        row = {"id": options.id(kind, len(rows[kind])), **fields}
        rows[kind].append(row)
        return row

    def after(start: datetime, end: datetime = now) -> datetime:
        seconds = max(0, int((end - start).total_seconds()))
        return start + timedelta(seconds=rng.randint(0, seconds))

    def read_at(created: datetime) -> datetime | None:
        return after(created) if rng.random() < 0.65 else None

    def moderation(index: int) -> str:
        # Guarantee a public first post even for tiny corpora.
        if index == 0:
            return "approved"
        return rng.choices(("approved", "pending", "rejected"), (94, 4, 2))[0]

    def mod_fields(status: str) -> dict:
        return {
            "moderation_status": status,
            "moderation_note": None if status == "approved" else (
                "Demo review: please add reproduction steps and remove unrelated promotional text."
            ),
        }

    def notify(recipient: UUID, actor: UUID | None, event: str, link: str,
               created: datetime, subject_type: str | None = None,
               subject_id: UUID | None = None) -> None:
        if actor == recipient:
            return
        add("notifications", recipient_id=recipient, actor_id=actor, event_type=event,
            subject_type=subject_type, subject_id=subject_id, link=link,
            created_at=created, read_at=read_at(created), coalesce_key=None,
            actor_count=1)

    def notify_moderation(kind: str, row: dict, question_id: UUID) -> None:
        if row["moderation_status"] != "approved":
            notify(row["author_id"], None, f"moderation_{row['moderation_status']}",
                   f"/questions/{question_id}", row["updated_at"], kind, row["id"])

    password_hash = hash_password(password)
    for i in range(options.users):
        first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
        if i < 2:
            username = f"{options.dataset}_{'admin' if i == 0 else 'member'}"
        else:
            suffix = f"_{i:05d}"
            username = f"{options.dataset}_{first}_{last}".lower()[:30 - len(suffix)] + suffix
        created = now - timedelta(days=rng.randint(210, 540), hours=rng.randint(0, 23))
        seen = now - timedelta(seconds=rng.randint(0, 90)) if i % 9 == 0 else after(created)
        add("users", username=username, email=f"{username}@example.com", password_hash=password_hash,
            role="admin" if i == 0 else "user", is_anonymized=False,
            bio=f"{first} {last}, {rng.choice(ROLES)} in {rng.choice(CITIES)}. "
                f"Building a {rng.choice(PROJECTS)} and learning about {rng.choice(TOPICS).tags[0]}. "
                "Here to compare approaches, share notes, and help with reproducible examples.",
            created_at=created, updated_at=seen, last_seen=seen)
    users = rows["users"]
    user_indices = {row["id"]: i for i, row in enumerate(users)}

    def other_user(user_id: UUID) -> dict:
        index = rng.randrange(len(users) - 1)
        if index >= user_indices[user_id]:
            index += 1
        return users[index]

    contexts: dict[UUID, tuple] = {}
    question_for: dict[UUID, UUID] = {}
    for i in range(options.questions):
        topic = TOPICS[i % len(TOPICS)]
        project = PROJECTS[(i // len(TOPICS)) % len(PROJECTS)]
        cohort = i // (len(TOPICS) * len(PROJECTS))
        title = f"{topic.title} in a {project}"
        if cohort:
            title += f" ({('mobile rollout', 'multi-team rollout', 'archive migration')[cohort % 3]} {cohort})"
        created = now - timedelta(days=rng.randint(1, 180), seconds=rng.randint(0, 86399))
        status = moderation(i)
        question = add("questions", author_id=users[i % len(users)]["id"],
                       title=title[:200],
                       body=f"I'm working on a {project}. {topic.problem}\n\n"
                            f"Here is the relevant part of our current implementation:\n\n```\n{topic.code}\n```\n\n"
                            f"{rng.choice(CONSTRAINTS)} We currently have around {rng.choice((800, 2400, 12000, 45000)):,} records.\n\n"
                            f"{rng.choice(DISCUSSION)}",
                       tags=list(topic.tags), view_count=int(rng.paretovariate(1.6) * 25),
                       accepted_answer_id=None, created_at=created, updated_at=created,
                       **mod_fields(status))
        contexts[question["id"]] = (topic, project)
        question_for[question["id"]] = question["id"]
        notify_moderation("question", question, question["id"])
    public_questions = [q for q in rows["questions"] if q["moderation_status"] == "approved"]
    # Leave some public questions unanswered so that feed filters have real work.
    answerable = [q for i, q in enumerate(public_questions) if i % 7 != 6]
    by_question: dict[UUID, list[dict]] = defaultdict(list)
    for i in range(options.answers):
        question = answerable[i % len(answerable)]
        topic, project = contexts[question["id"]]
        reply_index = len(by_question[question["id"]])
        body = topic.answers[reply_index % len(topic.answers)]
        if reply_index == 0:
            body += "\n\nA useful checklist:\n\n1. Reproduce the issue with a small fixture.\n2. Apply the change above.\n3. Verify the edge case before testing a larger dataset."
        else:
            body += f"\n\nFor the {project}, I would record the expected behavior in a regression test before changing the implementation."
        created = after(question["created_at"], now - timedelta(hours=1))
        answer = add("answers", author_id=other_user(question["author_id"])["id"],
                     question_id=question["id"], body=body, is_ai_assisted=False,
                     created_at=created, updated_at=created, **mod_fields(moderation(i)))
        by_question[question["id"]].append(answer)
        contexts[answer["id"]] = (topic, project)
        question_for[answer["id"]] = question["id"]
        if answer["moderation_status"] == "approved":
            notify(question["author_id"], answer["author_id"], "answer_created",
                   f"/questions/{question['id']}", created, "answer", answer["id"])
        notify_moderation("answer", answer, question["id"])
    for question in public_questions:
        choices = [a for a in by_question[question["id"]] if a["moderation_status"] == "approved"]
        if choices and rng.random() < 0.65:
            answer = rng.choice(choices)
            accepted.append({"question_key": question["id"], "answer_key": answer["id"],
                             "accepted_at": after(answer["created_at"])})

    targets = [("question", q) for q in public_questions] + [
        ("answer", a) for a in rows["answers"] if a["moderation_status"] == "approved"
    ]
    for i in range(options.comments):
        kind, parent = targets[i % len(targets)]
        topic, _ = contexts[parent["id"]]
        author = other_user(parent["author_id"])
        created = after(parent["created_at"])
        body = topic.comments[(i // len(targets)) % len(topic.comments)]
        if i % 4 == 0:
            body = f"@{users[user_indices[parent['author_id']]]['username']} {body}"
        comment = add("comments", author_id=author["id"], parent_type=kind, parent_id=parent["id"],
                      body=body, created_at=created, updated_at=created, **mod_fields(moderation(i)))
        qid = question_for[parent["id"]]
        if comment["moderation_status"] == "approved":
            notify(parent["author_id"], author["id"], "comment_created",
                   f"/questions/{qid}", created, "comment", comment["id"])
            if i % 4 == 0:
                notify(parent["author_id"], author["id"], "mentioned",
                       f"/questions/{qid}", created, "comment", comment["id"])
        notify_moderation("comment", comment, qid)

    vote_capacity = len(targets) * (len(users) - 1)
    if options.votes > vote_capacity:
        raise ValueError(f"votes exceeds the {vote_capacity} eligible non-self voter/post pairs; reduce --votes or add users/posts")
    vote_groups: dict[UUID, list[dict]] = defaultdict(list)
    for slot in rng.sample(range(vote_capacity), options.votes):
        target_index, voter_index = divmod(slot, len(users) - 1)
        kind, target = targets[target_index]
        if voter_index >= user_indices[target["author_id"]]:
            voter_index += 1
        vote = add("votes", voter_id=users[voter_index]["id"], target_type=kind,
                   target_id=target["id"], value=1 if rng.random() < 0.87 else -1,
                   created_at=after(target["created_at"]))
        vote_groups[target["id"]].append(vote)
    for kind, target in targets:
        votes = vote_groups[target["id"]]
        if votes:
            latest = max(votes, key=lambda v: v["created_at"])
            add("notifications", recipient_id=target["author_id"], actor_id=latest["voter_id"],
                event_type="vote_cast", subject_type=kind, subject_id=target["id"],
                link=f"/questions/{question_for[target['id']]}",
                coalesce_key=f"vote:{kind}:{target['id']}", actor_count=len(votes),
                created_at=latest["created_at"], read_at=read_at(latest["created_at"]))

    pair_capacity = len(users) * (len(users) - 1) // 2
    for i, rank in enumerate(rng.sample(range(pair_capacity), options.friendships)):
        # Decode a triangular pair index without building all O(users**2) pairs.
        b = (1 + math.isqrt(1 + 8 * rank)) // 2
        a = rank - b * (b - 1) // 2
        requester, addressee = users[a], users[b]
        if rng.random() < 0.5:
            requester, addressee = addressee, requester
        status = "accepted" if i == 0 else rng.choices(("accepted", "pending", "rejected"), (75, 20, 5))[0]
        created = now - timedelta(days=rng.randint(15, 200), hours=rng.randint(0, 23))
        updated = created if status == "pending" else created + timedelta(hours=rng.randint(1, 72))
        add("friendships", requester_id=requester["id"], addressee_id=addressee["id"],
            status=status, created_at=created, updated_at=updated)
        notify(addressee["id"], requester["id"], "friend_request", f"/users/{requester['id']}", created)
        if status == "accepted":
            notify(requester["id"], addressee["id"], "friend_accepted", f"/users/{addressee['id']}", updated)

    friends = [f for f in rows["friendships"] if f["status"] == "accepted"]
    if options.messages:
        turns = math.ceil(options.messages / len(friends))
        for i in range(options.messages):
            friend = friends[i % len(friends)]
            turn = i // len(friends)
            sender, receiver = friend["requester_id"], friend["addressee_id"]
            if turn % 2:
                sender, receiver = receiver, sender
            receiver_name = users[user_indices[receiver]]["username"]
            topic = TOPICS[(i % len(friends)) % len(TOPICS)]
            project = PROJECTS[(i % len(friends)) % len(PROJECTS)]
            created = friend["updated_at"] + (now - friend["updated_at"]) * ((turn + 1) / (turns + 1))
            add("messages", sender_id=sender, receiver_id=receiver,
                body=CONVERSATION[turn % len(CONVERSATION)].format(name=receiver_name, topic=topic.title.lower(), project=project),
                created_at=created, read_at=read_at(created))

    # Activity cannot happen after the account was last seen. Include reads and
    # accepted answers, which need not create a new content row of their own.
    def seen(user_id: UUID, at: datetime | None) -> None:
        if at is not None:
            user = users[user_indices[user_id]]
            user["last_seen"] = max(user["last_seen"], at)

    for kind in ("questions", "answers", "comments"):
        for row in rows[kind]:
            seen(row["author_id"], row["created_at"])
    for row in rows["votes"]:
        seen(row["voter_id"], row["created_at"])
    for row in rows["friendships"]:
        seen(row["requester_id"], row["created_at"])
        if row["status"] != "pending":
            seen(row["addressee_id"], row["updated_at"])
    for row in rows["messages"]:
        seen(row["sender_id"], row["created_at"])
        seen(row["receiver_id"], row["read_at"])
    for row in rows["notifications"]:
        seen(row["recipient_id"], row["read_at"])
    authors = {q["id"]: q["author_id"] for q in rows["questions"]}
    for row in accepted:
        seen(authors[row["question_key"]], row["accepted_at"])
    return Corpus(rows, accepted)


async def seed_database(engine: AsyncEngine, options: SeedOptions,
                        password: str = DEFAULT_PASSWORD, now: datetime | None = None) -> dict[str, int] | None:
    """Insert a dataset atomically, or leave a previously seeded dataset intact.

    The first deterministic user ID acts as the dataset marker. No seed path
    truncates, updates or removes existing users/content. A name/ID collision
    elsewhere aborts the entire transaction instead of silently mixing datasets.
    """
    options.validate()
    async with engine.begin() as connection:
        await connection.execute(text("SELECT pg_advisory_xact_lock(:key)"),
                                 {"key": options.namespace.int % (2**63)})
        existing = await connection.scalar(select(User.id).where(User.id == options.id("users", 0)))
        if existing is not None:
            return None
        corpus = build_corpus(options, password, now)
        for model in MODELS:
            entries = corpus.rows[model.__tablename__]
            for start in range(0, len(entries), BATCH_SIZE):
                await connection.execute(insert(model.__table__), entries[start:start + BATCH_SIZE])
        # Questions and answers form a cycle: attach accepted answers last.
        statement = update(Question.__table__).where(Question.id == bindparam("question_key")).values(
            accepted_answer_id=bindparam("answer_key"), updated_at=bindparam("accepted_at")
        )
        for start in range(0, len(corpus.accepted), BATCH_SIZE):
            await connection.execute(statement, corpus.accepted[start:start + BATCH_SIZE])
    return corpus.counts


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    defaults = SeedOptions()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--dataset", default=defaults.dataset, help="Named, idempotent dataset; choose a new name to add another corpus")
    parser.add_argument("--random-seed", type=int, default=defaults.random_seed, help="Reproducible content and relationship generation")
    for name in ("users", "questions", "answers", "comments", "votes", "friendships", "messages"):
        parser.add_argument(f"--{name}", type=int, default=getattr(defaults, name), help=f"Number of {name}")
    parser.add_argument("--dry-run", action="store_true", help="Build and summarize the corpus without connecting to a database")
    return parser.parse_args(argv)


async def run(options: SeedOptions, password: str) -> dict[str, int] | None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL is required; use make run, or configure .env and run make seed")
    engine = create_async_engine(database_url)
    try:
        return await seed_database(engine, options, password)
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    # Compose injects .env; direct/local invocations also work from backend.
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env", override=False, interpolate=False)
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False, interpolate=False)
    options = SeedOptions(**{key: value for key, value in vars(args).items() if key != "dry_run"})
    password = os.environ.get("SEED_PASSWORD", DEFAULT_PASSWORD)
    try:
        if args.dry_run:
            counts = build_corpus(options, password).counts
        else:
            counts = asyncio.run(run(options, password))
    except ValueError as exc:
        print(f"Seed configuration error: {exc}", file=sys.stderr)
        return 2
    except SQLAlchemyError:
        print("Seeding failed and was rolled back. Check DATABASE_URL, apply migrations, and check for conflicting demo usernames. No existing data was replaced.", file=sys.stderr)
        return 1
    if counts is None:
        print(f"Dataset '{options.dataset}' already exists; left all data unchanged. Use a new --dataset name to add a separate corpus.")
        return 0
    print(f"{'Planned' if args.dry_run else 'Seeded'} dataset '{options.dataset}':")
    for name, count in counts.items():
        print(f"  {name:14} {count:>8,}")
    print(f"  total          {sum(counts.values()):>8,}")
    if not args.dry_run:
        print(f"Demo logins: {options.dataset}_admin@example.com (admin), {options.dataset}_member@example.com (member)")
        print("Password: SEED_PASSWORD if configured, otherwise the development-only password documented in README.md.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
