from pydantic import BaseModel, EmailStr, Field, field_validator


class PasswordInputModel(BaseModel):
    @field_validator("password", "current_password", "new_password", check_fields=False)
    @classmethod
    def validate_password_input(cls, value: str | None) -> str | None:
        if value is not None:
            if "\0" in value:
                raise ValueError("Password must not contain a null byte")
            if len(value) > 128:
                raise ValueError("Password must be at most 128 characters")
            value.encode("utf-8")
        return value


class RegisterIn(PasswordInputModel):
    email: EmailStr

    username: str = Field(
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(char.isalpha() for char in value):
            raise ValueError(
                "Password must contain at least one letter"
            )

        if not any(char.isdigit() for char in value):
            raise ValueError(
                "Password must contain at least one digit"
            )

        return value


class LoginIn(PasswordInputModel):
    email: EmailStr
    password: str


class PasswordChangeIn(PasswordInputModel):
    current_password: str

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(char.isalpha() for char in value):
            raise ValueError(
                "Password must contain at least one letter"
            )

        if not any(char.isdigit() for char in value):
            raise ValueError(
                "Password must contain at least one digit"
            )

        return value



class AccountDeleteIn(PasswordInputModel):
    password: str | None = None
    confirm: str | None = None



class GoogleLinkIn(PasswordInputModel):
    password: str
