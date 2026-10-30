from passlib.context import CryptContext


pwd_context = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    bcrypt_sha256__rounds=12,
    bcrypt__rounds=12,
    deprecated="auto",
)


def hash_password(password: str) -> str:
    if "\0" in password:
        raise ValueError("Password must not contain a null byte")
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    if "\0" in plain:
        return False
    try:
        if pwd_context.identify(hashed) == "bcrypt" and len(plain.encode("utf-8")) > 72:
            return False
        return pwd_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


DUMMY_PASSWORD_HASH = pwd_context.hash("dummy-password-123")
