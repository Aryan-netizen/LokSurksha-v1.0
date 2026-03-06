# Crime Heatmap Project Workflow

## System Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Next.js        │◄───────►│  Flask Backend   │◄───────►│  PostgreSQL     │
│  Frontend       │  REST   │  (Python)        │  SQL    │  Database       │
│  (Port 3000)    │  API    │  (Port 5000)     │         │                 │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │
        │                            │
        │                    ┌───────▼────────┐
        │                    │                │
        │                    │  SocketIO      │
        │                    │  (Real-time)   │
        │                    │                │
        └───────────────────►└────────────────┘
```

## Project Structure

```
Loksuraksha/
├── crime-heatmap-flask/          # Backend (Flask API)
│   ├── app/
│   │   ├── __init__.py           # Flask app factory
│   │   ├── config.py             # Configuration
│   │   ├── models.py             # Database models
│   │   ├── schemas.py            # Data validation schemas
│   │   ├── extensions.py         # Flask extensions (DB, SocketIO)
│   │   ├── api/                  # API endpoints
│   │   │   ├── auth.py           # Authentication (OTP)
│   │   │   ├── fir.py            # FIR verification
│   │   │   ├── reports.py        # Crime reports CRUD
│   │   │   └── analytics.py      # Analytics & heatmap data
│   │   └── services/             # Business logic
│   │       ├── analytics_service.py
│   │       ├── area_service.py
│   │       ├── geocode_service.py
│   │       ├── nlp_service.py
│   │       ├── otp_service.py
│   │       └── socket_service.py
│   ├── wsgi.py                   # WSGI entry point
│   ├── requirements.txt          # Python dependencies
│   └── instance/                 # Runtime data
│       ├── site.db               # SQLite (dev)
│       └── uploads/              # User uploads
│
├── frontend/                     # Frontend (Next.js)
│   ├── src/
│   │   ├── app/                  # Next.js app router
│   │   │   ├── page.js           # Home page
│   │   │   ├── heatmap/          # Heatmap visualization
│   │   │   ├── report/           # Report submission
│   │   │   ├── feed/             # Crime feed
│   │   │   ├── analytic/         # Analytics dashboard
│   │   │   └── safety/           # Route safety checker
│   │   ├── components/           # Reusable components
│   │   │   └── ui/               # UI components
│   │   ├── lib/
│   │   │   └── api.js            # API client functions
│   │   └── data/                 # Static data
│   ├── package.json              # Node dependencies
│   └── next.config.mjs           # Next.js config
│
└── render.yaml                   # Render deployment config
```

## User Flow

### 1. Report Crime Flow

```
User Opens App
    ↓
Navigate to /report
    ↓
Fill Crime Details
├── Location (map picker or search)
├── Crime Type (dropdown)
├── Description (text)
├── Severity (low/medium/high)
└── Evidence Photo (optional)
    ↓
[OTP Verification] (if enabled)
├── Enter Phone Number
├── Receive OTP via SMS
└── Verify OTP Code
    ↓
[FIR Verification] (optional)
├── Enter FIR Number
└── Upload FIR Document
    ↓
Submit Report
    ↓
Backend Processing
├── Validate data
├── Geocode location
├── Analyze evidence
├── Extract tags (NLP)
├── Calculate risk score
└── Save to database
    ↓
Real-time Broadcast (SocketIO)
├── Notify connected clients
└── Update heatmap
    ↓
Success Response
└── Redirect to Feed/Heatmap
```

### 2. View Heatmap Flow

```
User Opens /heatmap
    ↓
Frontend Requests Data
├── GET /api/reports/heatmap
└── GET /api/reports/heatmap/trend
    ↓
Backend Processes
├── Query database for reports
├── Group by location
├── Calculate intensity
└── Apply time filters
    ↓
Return Heatmap Data
├── Coordinates (lat, lng)
├── Intensity (0-1)
└── Crime counts
    ↓
Render Map
├── Load MapTiler base map
├── Apply heatmap layer
├── Add crime markers
└── Enable interactions
    ↓
Real-time Updates
└── SocketIO pushes new reports
    └── Update heatmap dynamically
```

### 3. Analytics Flow

```
User Opens /analytic
    ↓
Select Filters
├── Area/Location
├── Time Range (days)
└── Crime Type
    ↓
Request Analytics
└── GET /api/reports/analytics?area=X&days=Y
    ↓
Backend Calculates
├── Total reports
├── Crime type distribution
├── Severity breakdown
├── Trend analysis
├── Hotspot identification
└── Time patterns
    ↓
Display Charts
├── Bar charts (crime types)
├── Pie charts (severity)
├── Line graphs (trends)
└── Statistics cards
```

### 4. Route Safety Flow

```
User Opens /safety
    ↓
Enter Route Details
├── Origin (address/coordinates)
└── Destination (address/coordinates)
    ↓
Request Safety Analysis
└── GET /api/reports/route/safety?origin=X&destination=Y
    ↓
Backend Processing
├── Geocode addresses
├── Calculate route
├── Query nearby crimes
├── Calculate risk scores
├── Identify danger zones
└── Generate safe alternatives
    ↓
Display Results
├── Route on map
├── Risk level (low/medium/high)
├── Danger zones highlighted
├── Safety recommendations
└── Alternative routes
```

## API Endpoints

### Authentication
- `POST /api/auth/otp/send` - Send OTP to phone
- `POST /api/auth/otp/verify` - Verify OTP code

### Crime Reports
- `GET /api/reports` - List all reports
- `POST /api/reports` - Create new report
- `GET /api/reports/:id` - Get single report
- `POST /api/reports/:id/confirm` - Confirm/dispute report
- `GET /api/reports/heatmap` - Get heatmap data
- `GET /api/reports/heatmap/trend` - Get trend data
- `GET /api/reports/analytics` - Get analytics
- `GET /api/reports/route/safety` - Check route safety
- `POST /api/reports/location/search` - Geocode address
- `POST /api/reports/location/reverse` - Reverse geocode
- `POST /api/reports/suggestions` - Get AI suggestions

### FIR Verification
- `POST /api/fir/verify` - Verify FIR document
- `POST /api/fir/search` - Search FIR records

### Comments
- `GET /api/reports/:id/comments` - Get comments
- `POST /api/reports/:id/comments` - Add comment

### Alerts
- `GET /api/reports/alerts/check` - Check geo-based alerts

## Real-time Features (SocketIO)

### Events

**Client → Server:**
- `connect` - Client connects
- `join_area` - Subscribe to area updates
- `leave_area` - Unsubscribe from area

**Server → Client:**
- `new_report` - New crime report created
- `report_updated` - Report status changed
- `area_alert` - High-risk area alert
- `stats_update` - Statistics updated

## Data Models

### CrimeReport
```python
{
    id: int
    location_lat: float
    location_lng: float
    location_name: string
    area: string
    crime_type: string
    description: string
    severity: string (low/medium/high)
    image_url: string
    reported_at: datetime
    status: string (pending/verified/disputed)
    verification_score: int
    risk_score: float
    tags: list[string]
}
```

### Comment
```python
{
    id: int
    report_id: int
    author_name: string
    content: string
    created_at: datetime
}
```

### AreaAlias
```python
{
    id: int
    canonical_name: string
    alias: string
}
```

## Technology Stack

### Frontend
- **Framework:** Next.js 16 (React 19)
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI, Material-UI
- **Maps:** MapTiler SDK
- **HTTP Client:** Fetch API
- **Real-time:** Socket.IO Client

### Backend
- **Framework:** Flask 3.0
- **Database:** PostgreSQL (production), SQLite (dev)
- **ORM:** SQLAlchemy
- **Real-time:** Flask-SocketIO
- **Validation:** Marshmallow
- **Image Processing:** Pillow
- **HTTP Client:** Requests

### Infrastructure
- **Hosting:** Render.com
- **Database:** Render PostgreSQL
- **File Storage:** Local filesystem
- **SMS:** Twilio (optional)
- **Geocoding:** Nominatim (OpenStreetMap)

## Development Workflow

### Local Development

1. **Start Backend:**
   ```bash
   cd crime-heatmap-flask
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   python app.py
   # Runs on http://localhost:5000
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   # Runs on http://localhost:3000
   ```

3. **Environment Variables:**
   - Backend: Create `.env` in `crime-heatmap-flask/`
   - Frontend: Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000`

### Production Deployment

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Your message"
   git push origin main
   ```

2. **Render Auto-deploys:**
   - Backend: Detects changes, rebuilds, redeploys
   - Frontend: Detects changes, rebuilds, redeploys
   - Database: Always running

3. **Monitor:**
   - Check logs in Render dashboard
   - Verify services are running
   - Test API endpoints

## Security Features

1. **OTP Verification:** Phone number verification for reports
2. **Rate Limiting:** Prevent spam submissions
3. **Duplicate Detection:** Block duplicate reports
4. **Suspicious Content:** AI-based content filtering
5. **FIR Verification:** Optional document verification
6. **CORS:** Restricted to frontend domain
7. **Input Validation:** Schema-based validation
8. **SQL Injection:** Protected by SQLAlchemy ORM

## Performance Optimizations

1. **Database Indexing:** On location, area, timestamp
2. **Caching:** Area name mapping cached
3. **Connection Pooling:** PostgreSQL connection pool
4. **Image Compression:** Uploaded images optimized
5. **Lazy Loading:** Frontend components lazy loaded
6. **API Pagination:** Large datasets paginated
7. **Real-time Throttling:** SocketIO event throttling

## Monitoring & Maintenance

### Health Checks
- Backend: `/` endpoint returns 200
- Database: Connection pool monitoring
- Frontend: Next.js health check

### Logs
- Application logs: Render dashboard
- Error tracking: Console logs
- Performance: Render metrics

### Backups
- Database: Render automatic backups (paid plans)
- Code: GitHub repository
- Uploads: Local filesystem (consider cloud storage)

## Future Enhancements

1. **Mobile App:** React Native version
2. **AI Predictions:** Crime prediction models
3. **User Accounts:** Full authentication system
4. **Admin Dashboard:** Moderation tools
5. **Push Notifications:** Mobile alerts
6. **Multi-language:** i18n support
7. **Cloud Storage:** S3 for uploads
8. **Advanced Analytics:** ML-based insights
9. **Integration:** Police department APIs
10. **Gamification:** Community engagement features
