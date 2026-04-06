from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    organization_name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=200)
    full_name: str = Field("", max_length=200)


class SetupRequest(BaseModel):
    """First admin for the default organization (legacy data on tenant_id=1)."""
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=200)
    full_name: str = Field(..., min_length=1, max_length=200)


class MeUpdateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=200)
