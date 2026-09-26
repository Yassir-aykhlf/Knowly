from pydantic import BaseModel, EmailStr, Field, field_validator

class RegisterIn(BaseModel):
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
            raise ValueError("Password must contain at least one letter")

        if not any(char.isdigit() for char in value):
            raise ValueError("Password must contain at least one digit")

        return value

class LoginIn(BaseModel):
    email : EmailStr
    password : str
