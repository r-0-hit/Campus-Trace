import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base


class Role(str, enum.Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    ADMIN = "ADMIN"


class RiskCategory(str, enum.Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    ELEVATED = "ELEVATED"
    HIGH = "HIGH"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    student: Mapped["Student | None"] = relationship(back_populates="user", uselist=False)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    student_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    course: Mapped[str] = mapped_column(String(100), default="Undeclared")
    user: Mapped[User] = relationship(back_populates="student")
    cases: Mapped[list["Case"]] = relationship(back_populates="student")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="student")


class Disease(Base):
    __tablename__ = "diseases"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(Text, default="Configurable prototype profile")
    transmission_mode: Mapped[str] = mapped_column(String(50), default="respiratory")
    exposure_window_hours: Mapped[int] = mapped_column(Integer, default=72)
    symptoms: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    environment_type: Mapped[str] = mapped_column(String(50), default="indoor")
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    disease_id: Mapped[int] = mapped_column(ForeignKey("diseases.id"))
    date_reported: Mapped[date] = mapped_column(Date)
    symptom_onset: Mapped[date | None] = mapped_column(Date, nullable=True)
    symptoms: Mapped[list[str]] = mapped_column(JSON, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    student: Mapped[Student] = relationship(back_populates="cases")
    disease: Mapped[Disease] = relationship()


class ContactEvent(Base):
    """Synthetic proximity event; Neo4j is the production graph projection."""

    __tablename__ = "contact_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_a_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    student_b_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_minutes: Mapped[float] = mapped_column(Float)
    estimated_distance_meters: Mapped[float] = mapped_column(Float)
    indoor: Mapped[bool] = mapped_column(Boolean, default=True)
    encounter_count: Mapped[int] = mapped_column(Integer, default=1)


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    status: Mapped[str] = mapped_column(String(24), default="COMPLETED")
    max_depth: Mapped[int] = mapped_column(Integer, default=2)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    case: Mapped[Case] = relationship()


class InvestigationContact(Base):
    __tablename__ = "investigation_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    graph_distance: Mapped[int] = mapped_column(Integer)
    risk_score: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    category: Mapped[RiskCategory] = mapped_column(Enum(RiskCategory))
    feature_contributions: Mapped[dict] = mapped_column(JSON, default=dict)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    risk_score: Mapped[float] = mapped_column(Float)
    category: Mapped[RiskCategory] = mapped_column(Enum(RiskCategory))
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    student: Mapped[Student] = relationship(back_populates="notifications")


class SymptomReport(Base):
    __tablename__ = "symptom_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id"), unique=True)
    response: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
