from datetime import datetime, timezone
from .extensions import db


class CrimeReport(db.Model):
    __tablename__ = 'crime_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(500), nullable=False)
    location_lat = db.Column(db.Float, nullable=False)
    location_lng = db.Column(db.Float, nullable=False)
    crime_level = db.Column(db.String(50), nullable=False, default="low")
    image_url = db.Column(db.String(200), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    comments = db.relationship(
        "Comment",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy=True,
    )
    tags = db.relationship(
        "ReportTag",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy=True,
    )
    confirmations = db.relationship(
        "ReportConfirmation",
        back_populates="report",
        cascade="all, delete-orphan",
        lazy=True,
    )
    verification = db.relationship(
        "ReportVerification",
        back_populates="report",
        cascade="all, delete-orphan",
        uselist=False,
        lazy=True,
    )

    def __repr__(self):
        return f'<CrimeReport {self.id} - {self.crime_level}>'


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("crime_reports.id"), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("comments.id"), nullable=True, index=True)
    author_name = db.Column(db.String(80), nullable=False, default="Citizen")
    content = db.Column(db.String(500), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    report = db.relationship("CrimeReport", back_populates="comments")
    parent = db.relationship("Comment", remote_side=[id], backref="replies", lazy=True)

    def __repr__(self):
        return f"<Comment {self.id} report={self.report_id}>"


class ReportTag(db.Model):
    __tablename__ = "report_tags"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("crime_reports.id"), nullable=False, index=True)
    tag = db.Column(db.String(64), nullable=False, index=True)

    report = db.relationship("CrimeReport", back_populates="tags")

    def __repr__(self):
        return f"<ReportTag report={self.report_id} tag={self.tag}>"


class AreaAlias(db.Model):
    __tablename__ = "area_aliases"

    id = db.Column(db.Integer, primary_key=True)
    area_key = db.Column(db.String(64), nullable=False, unique=True, index=True)
    area_name = db.Column(db.String(120), nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self):
        return f"<AreaAlias {self.area_key} -> {self.area_name}>"


class ReportConfirmation(db.Model):
    __tablename__ = "report_confirmations"
    __table_args__ = (
        db.UniqueConstraint("report_id", "client_fingerprint", name="uq_report_confirmation_client"),
    )

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("crime_reports.id"), nullable=False, index=True)
    client_fingerprint = db.Column(db.String(128), nullable=False, index=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    report = db.relationship("CrimeReport", back_populates="confirmations")

    def __repr__(self):
        return f"<ReportConfirmation report={self.report_id}>"


class ReportVerification(db.Model):
    __tablename__ = "report_verifications"

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.Integer, db.ForeignKey("crime_reports.id"), nullable=False, unique=True, index=True)
    otp_verified = db.Column(db.Boolean, nullable=False, default=False)
    fir_verified = db.Column(db.Boolean, nullable=False, default=False)
    fir_score = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    report = db.relationship("CrimeReport", back_populates="verification")

    def __repr__(self):
        return f"<ReportVerification report={self.report_id} otp={self.otp_verified} fir={self.fir_verified}>"


class SubmissionAudit(db.Model):
    __tablename__ = "submission_audits"

    id = db.Column(db.Integer, primary_key=True)
    client_fingerprint = db.Column(db.String(128), nullable=False, index=True)
    description_hash = db.Column(db.String(64), nullable=False, index=True)
    location_bucket = db.Column(db.String(64), nullable=False, index=True)
    was_blocked = db.Column(db.Boolean, nullable=False, default=False)
    block_reason = db.Column(db.String(128), nullable=True)
    suspicious_score = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    def __repr__(self):
        return f"<SubmissionAudit client={self.client_fingerprint} blocked={self.was_blocked}>"
