from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.entities import RiskCategory, Role


class ApiModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(ApiModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(ApiModel):
    access_token: str
    token: str | None = None
    token_type: str = "bearer"
    role: Role


class UserMe(ApiModel):
    id: int
    username: str
    full_name: str
    role: Role
    student_code: str | None = None


class CaseReportRequest(ApiModel):
    disease_id: int
    date_reported: date
    symptom_onset: date | None = None
    symptoms: list[str] = Field(default_factory=list, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)


class CaseResponse(ApiModel):
    id: int
    disease: str
    date_reported: date
    status: str


class RiskEstimate(ApiModel):
    risk_score: float
    confidence: float
    category: RiskCategory
    feature_contributions: dict[str, float]
    model_version: str
    disclaimer: str


class NotificationResponse(ApiModel):
    id: int
    title: str
    message: str
    risk_score: float
    category: RiskCategory
    is_acknowledged: bool
    created_at: datetime


class SymptomResponseRequest(ApiModel):
    response: str = Field(pattern="^(YES|NO|NOT_SURE)$")
