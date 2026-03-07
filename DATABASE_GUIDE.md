# Database Architecture Guide

## Overview

Your LokSuraksha project uses a **dual-database approach**:
- **SQLite** for local development
- **PostgreSQL** for production (Render.com)

---

## Database Systems

### Development: SQLite

**Location**: `/tmp/loksurksha/loksurksha.db` (or `instance/site.db`)

**Characteristics**:
- ✅ File-based database (no server needed)
- ✅ Zero configuration
- ✅ Perfect for development
- ✅ Lightweight (~1MB)
- ❌ Not suitable for production
- ❌ Limited concurrent writes
- ❌ No network access

**When it's used**:
```python
# When DATABASE_URL is not set
SQLALCHEMY_DATABASE_URI = "sqlite:///tmp/loksurksha/loksurksha.db"
```

### Production: PostgreSQL

**Location**: Render.com managed database

**Characteristics**:
- ✅ Production-grade RDBMS
- ✅ ACID compliant
- ✅ Handles concurrent connections
- ✅ Supports complex queries
- ✅ Automatic backups (paid plans)
- ✅ Scalable
- ✅ Geospatial support (PostGIS)

**When it's used**:
```python
# When DATABASE_URL environment variable is set
SQLALCHEMY_DATABASE_URI = "postgresql://user:pass@host:5432/dbname"
```

---

## Database Configuration

### Connection String Format

```python
# SQLite (Development)
sqlite:///path/to/database.db

# PostgreSQL (Production)
postgresql://username:password@hostname:port/database_name

# Example from Render
postgresql://crime_user:abc123@dpg-xyz.oregon-postgres.render.com:5432/crime_heatmap_db
```

### Auto-Detection Logic

```python
def _resolve_database_uri() -> str:
    database_url = os.environ.get("DATABASE_URL")
    
    if database_url:
        # Production: Use PostgreSQL from environment
        # Fix Render's postgres:// to postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return database_url
    else:
        # Development: Use SQLite
        return "sqlite:///tmp/loksurksha/loksurksha.db"
```

### Connection Pool Settings

```python
SQLALCHEMY_ENGINE_OPTIONS = {
    "pool_pre_ping": True,      # Test connections before using
    "pool_recycle": 300,        # Recycle connections after 5 minutes
}
```

**Why these settings?**
- `pool_pre_ping`: Prevents "connection lost" errors
- `pool_recycle`: Avoids stale connections in PostgreSQL

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│  CrimeReport    │◄──────┐
│  (Main Table)   │       │
└────┬────────────┘       │
     │                    │
     │ 1:N                │ 1:1
     │                    │
     ├──────────┬─────────┼──────────┬──────────────┐
     │          │         │          │              │
     ▼          ▼         ▼          ▼              ▼
┌─────────┐ ┌──────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
│ Comment │ │ Tag  │ │Confirm │ │Verification│ │SubmissionAudit│
└─────────┘ └──────┘ └────────┘ └──────────┘ └──────────────┘
```

### Tables Overview

| Table | Purpose | Records |
|-------|---------|---------|
| `crime_reports` | Main crime reports | ~1000s |
| `comments` | User comments on reports | ~10,000s |
| `report_tags` | Crime categorization tags | ~5,000s |
| `area_aliases` | Location name mappings | ~100s |
| `report_confirmations` | User confirmations | ~5,000s |
| `report_verifications` | OTP/FIR verification | ~1000s |
| `submission_audits` | Spam/fraud detection logs | ~10,000s |

---

## Table Schemas

### 1. crime_reports (Main Table)

**Purpose**: Stores all crime reports submitted by users

```sql
CREATE TABLE crime_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description VARCHAR(500) NOT NULL,
    location_lat FLOAT NOT NULL,
    location_lng FLOAT NOT NULL,
    crime_level VARCHAR(50) NOT NULL DEFAULT 'low',
    image_url VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_crime_reports_location ON crime_reports(location_lat, location_lng);
CREATE INDEX idx_crime_reports_created_at ON crime_reports(created_at);
CREATE INDEX idx_crime_reports_crime_level ON crime_reports(crime_level);
```

**Columns**:
- `id`: Unique identifier (auto-increment)
- `description`: Crime description (max 500 chars)
- `location_lat`: Latitude (-90 to 90)
- `location_lng`: Longitude (-180 to 180)
- `crime_level`: Severity (low/medium/high)
- `image_url`: Path to uploaded evidence photo
- `created_at`: Timestamp with timezone

**Example Data**:
```json
{
  "id": 1,
  "description": "Robbery at gunpoint near market",
  "location_lat": 30.7333,
  "location_lng": 76.7794,
  "crime_level": "high",
  "image_url": "/uploads/crime_123.jpg",
  "created_at": "2024-03-08T14:30:00Z"
}
```

### 2. comments

**Purpose**: User comments and discussions on reports

```sql
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    parent_id INTEGER,
    author_name VARCHAR(80) NOT NULL DEFAULT 'Citizen',
    content VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES crime_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_comments_report_id ON comments(report_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
```

**Features**:
- Nested comments (replies)
- Cascade delete (delete report → delete comments)
- Anonymous or named authors

### 3. report_tags

**Purpose**: Categorize reports with multiple tags (NLP-generated)

```sql
CREATE TABLE report_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    tag VARCHAR(64) NOT NULL,
    FOREIGN KEY (report_id) REFERENCES crime_reports(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_report_tags_report_id ON report_tags(report_id);
CREATE INDEX idx_report_tags_tag ON report_tags(tag);
```

**Example Tags**:
- `robbery`, `violence`, `weapon`, `night`, `market`, `gang`

**How tags are generated**:
```python
# NLP service extracts keywords from description
tags = nlp_service.extract_tags("Robbery at gunpoint near market")
# Returns: ['robbery', 'weapon', 'market']
```

### 4. area_aliases

**Purpose**: Map location variations to canonical names

```sql
CREATE TABLE area_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_key VARCHAR(64) NOT NULL UNIQUE,
    area_name VARCHAR(120) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE UNIQUE INDEX idx_area_aliases_key ON area_aliases(area_key);
```

**Example Data**:
```
area_key: "sector-17-chandigarh"
area_name: "Sector 17, Chandigarh, India"

area_key: "connaught-place-delhi"
area_name: "Connaught Place, New Delhi, India"
```

**Why needed?**
- Users might write "Sector 17" or "Sec 17" or "S-17"
- All map to same canonical name for grouping

### 5. report_confirmations

**Purpose**: Track user confirmations/disputes of reports

```sql
CREATE TABLE report_confirmations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    client_fingerprint VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES crime_reports(id) ON DELETE CASCADE,
    UNIQUE (report_id, client_fingerprint)
);

-- Indexes
CREATE INDEX idx_report_confirmations_report_id ON report_confirmations(report_id);
CREATE INDEX idx_report_confirmations_client ON report_confirmations(client_fingerprint);
```

**Features**:
- One confirmation per user per report (unique constraint)
- Client fingerprint prevents duplicate votes
- Used for crowdsourced verification

### 6. report_verifications

**Purpose**: Store OTP and FIR verification status

```sql
CREATE TABLE report_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL UNIQUE,
    otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    fir_verified BOOLEAN NOT NULL DEFAULT FALSE,
    fir_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES crime_reports(id) ON DELETE CASCADE
);

-- Index
CREATE UNIQUE INDEX idx_report_verifications_report_id ON report_verifications(report_id);
```

**Verification Levels**:
- `otp_verified`: Phone number verified via SMS OTP
- `fir_verified`: FIR document verified via AI/API
- `fir_score`: Confidence score (0-100)

### 7. submission_audits

**Purpose**: Fraud detection and spam prevention

```sql
CREATE TABLE submission_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_fingerprint VARCHAR(128) NOT NULL,
    description_hash VARCHAR(64) NOT NULL,
    location_bucket VARCHAR(64) NOT NULL,
    was_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    block_reason VARCHAR(128),
    suspicious_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_submission_audits_client ON submission_audits(client_fingerprint);
CREATE INDEX idx_submission_audits_hash ON submission_audits(description_hash);
CREATE INDEX idx_submission_audits_location ON submission_audits(location_bucket);
CREATE INDEX idx_submission_audits_created_at ON submission_audits(created_at);
```

**Detection Mechanisms**:
- **Rate limiting**: Max 5 reports per 5 minutes per client
- **Duplicate detection**: Same description + location within 15 minutes
- **Suspicious patterns**: Repeated submissions, spam keywords

---

## ORM (SQLAlchemy)

### What is SQLAlchemy?

**SQLAlchemy** is a Python ORM (Object-Relational Mapping) that:
- Maps Python classes to database tables
- Converts Python objects to SQL queries
- Handles database connections
- Provides query builder

### Model Definition Example

```python
class CrimeReport(db.Model):
    __tablename__ = 'crime_reports'
    
    # Columns
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(500), nullable=False)
    location_lat = db.Column(db.Float, nullable=False)
    
    # Relationships
    comments = db.relationship('Comment', back_populates='report')
```

### CRUD Operations

#### Create
```python
# Create new report
report = CrimeReport(
    description="Robbery at market",
    location_lat=30.7333,
    location_lng=76.7794,
    crime_level="high"
)
db.session.add(report)
db.session.commit()
```

#### Read
```python
# Get all reports
reports = CrimeReport.query.all()

# Get by ID
report = CrimeReport.query.get(1)

# Filter
high_crime = CrimeReport.query.filter_by(crime_level='high').all()

# Complex query
recent_reports = CrimeReport.query\
    .filter(CrimeReport.created_at > datetime.now() - timedelta(days=7))\
    .order_by(CrimeReport.created_at.desc())\
    .limit(10)\
    .all()
```

#### Update
```python
# Update report
report = CrimeReport.query.get(1)
report.crime_level = 'medium'
db.session.commit()
```

#### Delete
```python
# Delete report
report = CrimeReport.query.get(1)
db.session.delete(report)
db.session.commit()
```

### Relationships

#### One-to-Many
```python
# One report has many comments
class CrimeReport(db.Model):
    comments = db.relationship('Comment', back_populates='report')

class Comment(db.Model):
    report_id = db.Column(db.Integer, db.ForeignKey('crime_reports.id'))
    report = db.relationship('CrimeReport', back_populates='comments')

# Usage
report = CrimeReport.query.get(1)
for comment in report.comments:
    print(comment.content)
```

#### One-to-One
```python
# One report has one verification
class CrimeReport(db.Model):
    verification = db.relationship('ReportVerification', uselist=False)

class ReportVerification(db.Model):
    report_id = db.Column(db.Integer, db.ForeignKey('crime_reports.id'), unique=True)
    report = db.relationship('CrimeReport', back_populates='verification')
```

---

## Database Migrations

### What are Migrations?

Migrations are version-controlled database schema changes:
- Add/remove tables
- Add/remove columns
- Change column types
- Add indexes

### Flask-Migrate (Alembic)

```bash
# Initialize migrations (first time only)
flask db init

# Create migration after model changes
flask db migrate -m "Add crime_level column"

# Apply migration
flask db upgrade

# Rollback migration
flask db downgrade
```

### Migration Files

Located in `migrations/versions/`:
```python
# Example migration
def upgrade():
    op.add_column('crime_reports', 
        sa.Column('crime_level', sa.String(50), nullable=False, default='low')
    )

def downgrade():
    op.drop_column('crime_reports', 'crime_level')
```

---

## Indexing Strategy

### Why Indexes?

Indexes speed up queries by creating sorted lookup tables:
- **Without index**: Scan all rows (slow)
- **With index**: Binary search (fast)

### Current Indexes

```python
# Location-based queries (heatmap)
CREATE INDEX idx_crime_reports_location 
ON crime_reports(location_lat, location_lng);

# Time-based queries (recent reports)
CREATE INDEX idx_crime_reports_created_at 
ON crime_reports(created_at);

# Severity filtering
CREATE INDEX idx_crime_reports_crime_level 
ON crime_reports(crime_level);

# Foreign keys (joins)
CREATE INDEX idx_comments_report_id 
ON comments(report_id);
```

### Query Performance

```python
# Slow (no index)
SELECT * FROM crime_reports WHERE location_lat = 30.7333;
# Scans all rows: O(n)

# Fast (with index)
SELECT * FROM crime_reports WHERE location_lat = 30.7333;
# Uses index: O(log n)
```

---

## Data Flow

### Report Submission Flow

```
User submits form
    ↓
Frontend sends POST /api/reports
    ↓
Backend validates data
    ↓
Create CrimeReport object
    ↓
db.session.add(report)
    ↓
db.session.commit()
    ↓
SQLAlchemy generates SQL:
    INSERT INTO crime_reports 
    (description, location_lat, location_lng, crime_level, created_at)
    VALUES ('Robbery', 30.7333, 76.7794, 'high', '2024-03-08 14:30:00')
    ↓
Database executes INSERT
    ↓
Returns new report ID
    ↓
Backend returns JSON response
    ↓
Frontend displays success
```

### Heatmap Query Flow

```
Frontend requests GET /api/reports/heatmap
    ↓
Backend executes query:
    SELECT 
        location_lat, 
        location_lng, 
        COUNT(*) as count
    FROM crime_reports
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY location_lat, location_lng
    ↓
Database returns aggregated data
    ↓
Backend calculates intensity
    ↓
Returns JSON to frontend
    ↓
Frontend renders heatmap
```

---

## Database Size Estimates

### Storage Requirements

| Table | Rows | Size per Row | Total Size |
|-------|------|--------------|------------|
| crime_reports | 10,000 | ~200 bytes | ~2 MB |
| comments | 50,000 | ~150 bytes | ~7.5 MB |
| report_tags | 30,000 | ~50 bytes | ~1.5 MB |
| area_aliases | 500 | ~100 bytes | ~50 KB |
| report_confirmations | 20,000 | ~80 bytes | ~1.6 MB |
| report_verifications | 10,000 | ~60 bytes | ~600 KB |
| submission_audits | 100,000 | ~120 bytes | ~12 MB |
| **Total** | | | **~25 MB** |

### Render Free Tier

- **Storage**: 1 GB (plenty for this app)
- **Rows**: Unlimited
- **Connections**: 97 hours/month
- **Backups**: Manual only

---

## Backup Strategy

### Development (SQLite)

```bash
# Manual backup
cp /tmp/loksurksha/loksurksha.db backup_$(date +%Y%m%d).db

# Automated backup (cron)
0 2 * * * cp /tmp/loksurksha/loksurksha.db /backups/db_$(date +\%Y\%m\%d).db
```

### Production (PostgreSQL on Render)

**Free Tier**: No automatic backups
**Paid Plans**: Daily automatic backups

**Manual backup**:
```bash
# Export database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql
```

---

## Security Considerations

### SQL Injection Prevention

✅ **Safe (using ORM)**:
```python
# SQLAlchemy automatically escapes values
CrimeReport.query.filter_by(crime_level=user_input).all()
```

❌ **Unsafe (raw SQL)**:
```python
# Never do this!
db.session.execute(f"SELECT * FROM crime_reports WHERE crime_level = '{user_input}'")
```

### Data Encryption

- **In Transit**: HTTPS/TLS (automatic on Render)
- **At Rest**: PostgreSQL encryption (Render handles this)
- **Passwords**: Not stored (using OTP instead)

### Access Control

- **Database user**: Limited permissions
- **No direct access**: Only backend can query
- **API authentication**: OTP verification

---

## Monitoring & Maintenance

### Query Performance

```python
# Enable query logging (development)
import logging
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

# Logs all SQL queries
# SELECT * FROM crime_reports WHERE id = 1
```

### Connection Pool Monitoring

```python
# Check active connections
from sqlalchemy import inspect
inspector = inspect(db.engine)
print(inspector.get_table_names())
```

### Database Health Checks

```python
# Test connection
try:
    db.session.execute('SELECT 1')
    print("Database connected")
except Exception as e:
    print(f"Database error: {e}")
```

---

## Summary

### Database Choice
- **Development**: SQLite (file-based, zero config)
- **Production**: PostgreSQL (scalable, reliable)

### Schema
- **7 tables**: crime_reports, comments, tags, aliases, confirmations, verifications, audits
- **Relationships**: One-to-many, one-to-one
- **Indexes**: Location, time, foreign keys

### ORM
- **SQLAlchemy**: Python ORM for database operations
- **Flask-SQLAlchemy**: Flask integration
- **Flask-Migrate**: Database migrations

### Performance
- **Indexes**: Speed up queries
- **Connection pooling**: Reuse connections
- **Query optimization**: Use ORM efficiently

### Security
- **SQL injection**: Prevented by ORM
- **Encryption**: TLS in transit, at rest
- **Access control**: Limited permissions

---

**Last Updated**: March 2026
