from passlib.context import CryptContext

pwd_context = CryptContext(
    schemes=["bcrypt"],
    bcrypt__rounds=12,
    deprecated="auto",
)

def hash_password(password: str) -> str:
    hashed_pass = pwd_context.hash(password)
    return hashed_pass

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

DUMMY_PASSWORD_HASH = pwd_context.hash("dummy-password-123")