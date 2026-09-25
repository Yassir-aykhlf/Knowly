from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    bcrypt__rounds=12,
    deprecated="auto",
)

def hash_password(password: str) -> str:
    hashed_pass = pwd_context.hash(password)
    return hashed_pass