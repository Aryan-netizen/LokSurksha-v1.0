# LokSuraksha - Technology Stack

## Overview
Complete technology stack for the Crime Heatmap & AI Verification System

---

## Frontend Technologies

### Core Framework
- **Next.js 16.1.6** - React framework with App Router
- **React 19.2.3** - UI library
- **React DOM 19.2.3** - React rendering

### Styling & UI
- **Tailwind CSS 4.x** - Utility-first CSS framework
- **@tailwindcss/postcss** - PostCSS integration
- **Material-UI (MUI) 7.3.7** - Component library
  - @mui/material
  - @mui/icons-material
- **Emotion 11.14.0** - CSS-in-JS library
  - @emotion/react
  - @emotion/styled
- **Radix UI 1.4.3** - Headless UI components
- **class-variance-authority 0.7.1** - CVA for variants
- **clsx 2.1.1** - Conditional classnames
- **tailwind-merge 3.4.0** - Merge Tailwind classes
- **tw-animate-css 1.4.0** - Animation utilities

### Maps & Visualization
- **@maptiler/sdk 3.11.0** - Interactive maps
- **MapTiler API** - Map tiles and geocoding

### Icons & Assets
- **lucide-react 0.563.0** - Icon library
- **classnames 2.5.1** - Dynamic classnames

### Build Tools
- **PostCSS** - CSS processing
- **ESLint** - Code linting (optional)

---

## Backend Technologies

### Core Framework
- **Flask 3.0.0** - Python web framework
- **Python 3.11.0** - Programming language

### Database & ORM
- **PostgreSQL** - Production database (Render)
- **SQLite** - Development database
- **SQLAlchemy 2.0.36** - ORM
- **Flask-SQLAlchemy 3.1.1** - Flask-SQLAlchemy integration
- **Flask-Migrate 4.0.7** - Database migrations
- **psycopg2-binary 2.9.9** - PostgreSQL adapter

### Real-time Communication
- **Flask-SocketIO 5.3.6** - WebSocket support
- **python-socketio 5.11.0** - Socket.IO server
- **python-engineio 4.9.0** - Engine.IO server
- **eventlet 0.33.3** - Async networking

### API & Validation
- **Flask-Cors 4.0.0** - CORS handling
- **Marshmallow 3.21.1** - Object serialization/validation

### Image Processing
- **Pillow 9.5.0** - Image manipulation

### HTTP & External APIs
- **requests 2.31.0** - HTTP library

### Environment & Configuration
- **python-dotenv 1.0.1** - Environment variables

### Production Server
- **gunicorn 21.2.0** - WSGI HTTP server

---

## AI/ML Technologies

### Deep Learning Framework
- **PyTorch 2.0.0+** - Deep learning framework
- **torchvision 0.15.0+** - Computer vision models

### Computer Vision Models
- **CLIP (OpenAI)** - Image-text matching
  - Model: ViT-B/32
  - Size: ~400MB
- **YOLOv8n (Ultralytics)** - Object detection
  - ultralytics 8.0.0+
  - Model size: ~6MB

### OCR (Optical Character Recognition)
- **EasyOCR 1.7.0+** - Text extraction
- **OpenCV 4.8.0+** - Image preprocessing

### Data Processing
- **NumPy 1.24.0+** - Numerical computing
- **Pillow 10.0.0+** - Image handling

---

## Infrastructure & Deployment

### Hosting Platform
- **Render.com** - Cloud platform
  - Web Services (Flask, Next.js)
  - PostgreSQL Database
  - Free tier available

### Version Control
- **Git** - Version control
- **GitHub** - Code repository

### CI/CD
- **Render Auto-Deploy** - Automatic deployment on git push

### Domain & SSL
- **Render Custom Domains** - Custom domain support
- **Let's Encrypt** - Free SSL certificates (automatic)

---

## External Services & APIs

### Maps & Geocoding
- **MapTiler API** - Map tiles and styling
- **Nominatim (OpenStreetMap)** - Geocoding service
  - Forward geocoding (address → coordinates)
  - Reverse geocoding (coordinates → address)

### SMS & Authentication (Optional)
- **Twilio** - SMS OTP delivery
  - Account SID
  - Auth Token
  - Phone number

### Document Verification (Optional)
- **HyperVerge API** - FIR document verification

---

## Development Tools

### Package Managers
- **npm** - Node.js package manager
- **pip** - Python package manager

### Environment Management
- **venv** - Python virtual environment
- **node_modules** - Node.js dependencies

### Code Quality
- **ESLint** - JavaScript linting (optional)
- **Prettier** - Code formatting (optional)

### Testing
- **pytest** - Python testing framework (optional)
- **Jest** - JavaScript testing (optional)

---

## Database Schema

### Tables
1. **crime_reports** - Main crime reports
2. **comments** - User comments on reports
3. **report_tags** - Crime tags/categories
4. **area_aliases** - Location name variations
5. **report_confirmations** - User confirmations
6. **report_verifications** - AI verification results
7. **submission_audits** - Audit logs

---

## Security Technologies

### Authentication
- **OTP (One-Time Password)** - Phone verification
- **Session tokens** - Temporary access tokens

### Data Protection
- **CORS** - Cross-origin resource sharing
- **Input validation** - Marshmallow schemas
- **SQL injection protection** - SQLAlchemy ORM
- **Rate limiting** - Request throttling
- **Duplicate detection** - Spam prevention

### File Upload Security
- **File type validation** - Allowed extensions
- **File size limits** - 16MB max
- **Secure filename handling** - Path sanitization

---

## Performance Optimizations

### Frontend
- **Next.js SSR** - Server-side rendering
- **Code splitting** - Automatic by Next.js
- **Image optimization** - Next.js Image component
- **Lazy loading** - Component lazy loading

### Backend
- **Database indexing** - On location, area, timestamp
- **Connection pooling** - PostgreSQL pool
- **Caching** - Area name mapping cache
- **Query optimization** - Efficient SQL queries

### Real-time
- **WebSocket** - Persistent connections
- **Event throttling** - Prevent flooding
- **Room-based broadcasting** - Area-specific updates

---

## Monitoring & Logging

### Application Logs
- **Render Logs** - Centralized logging
- **Console logs** - Development debugging
- **Error tracking** - Exception logging

### Metrics
- **Render Metrics** - CPU, memory, requests
- **Database metrics** - Connection pool, query time

### Health Checks
- **HTTP endpoints** - Service health status
- **Database connectivity** - Connection verification

---

## Browser Compatibility

### Supported Browsers
- **Chrome** 90+
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+
- **Mobile browsers** - iOS Safari, Chrome Mobile

---

## System Requirements

### Development Environment
- **Node.js** 20.11.0+
- **Python** 3.11.0+
- **npm** 9.0.0+
- **pip** 23.0.0+
- **Git** 2.30.0+

### Production Environment
- **CPU** - 1 vCPU (Render free tier)
- **RAM** - 512MB (Render free tier)
- **Storage** - 1GB database (Render free tier)
- **Bandwidth** - 100GB/month (Render free tier)

### AI System Requirements
- **CPU** - Multi-core recommended
- **RAM** - 4GB+ for model loading
- **GPU** - CUDA-capable (optional, 10x faster)
- **Storage** - 2GB for models
- **Internet** - For first-time model downloads

---

## API Protocols & Standards

### REST API
- **HTTP/HTTPS** - Protocol
- **JSON** - Data format
- **RESTful** - API design pattern

### WebSocket
- **Socket.IO** - Real-time protocol
- **Engine.IO** - Transport layer

### Data Formats
- **JSON** - API responses
- **FormData** - File uploads
- **URL-encoded** - Form submissions

---

## File Formats Supported

### Images
- **JPEG/JPG** - Crime scene photos
- **PNG** - Screenshots, documents
- **GIF** - Animated images (limited)

### Documents
- **JPEG/PNG** - Scanned FIR documents
- **PDF** - Future support planned

---

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
SECRET_KEY=random_secret_key
DEBUG=false
REQUIRE_REPORT_OTP=false
OTP_PROVIDER=console
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
HYPERVERGE_FIR_VERIFY_URL=...
```

### Frontend
```
NEXT_PUBLIC_API_BASE_URL=https://backend-url.com
NEXT_PUBLIC_MAPTILER_API_KEY=...
```

---

## Version Control

### Repository Structure
```
main branch
├── crime-heatmap-flask/  (Backend)
├── frontend/              (Frontend)
├── crime_ai_system.py/    (AI System)
└── Documentation files
```

### Deployment Flow
```
Local Development
    ↓
Git Commit
    ↓
Git Push to GitHub
    ↓
Render Auto-Deploy
    ↓
Production Live
```

---

## License & Credits

### Open Source Libraries
- All dependencies are open source or have permissive licenses
- See individual package licenses for details

### Third-party Services
- MapTiler (Commercial API)
- Twilio (Commercial API)
- HyperVerge (Commercial API)
- Nominatim (Free, OpenStreetMap)

---

## Technology Decisions

### Why Next.js?
- Server-side rendering for SEO
- File-based routing
- Built-in optimization
- Great developer experience

### Why Flask?
- Lightweight and flexible
- Easy to learn and use
- Great for APIs
- Excellent ecosystem

### Why PostgreSQL?
- Robust and reliable
- ACID compliance
- Geospatial support (PostGIS ready)
- Free tier on Render

### Why Socket.IO?
- Real-time bidirectional communication
- Automatic reconnection
- Room-based broadcasting
- Fallback to polling

### Why CLIP + YOLO?
- CLIP: Zero-shot image classification
- YOLO: Fast object detection
- Both are state-of-the-art
- Pre-trained models available

---

## Future Technology Additions

### Planned
- [ ] Redis for caching
- [ ] Celery for background tasks
- [ ] AWS S3 for file storage
- [ ] Elasticsearch for search
- [ ] GraphQL API
- [ ] Mobile apps (React Native)
- [ ] Docker containerization
- [ ] Kubernetes orchestration
- [ ] Prometheus monitoring
- [ ] Grafana dashboards

### Under Consideration
- [ ] TypeScript migration
- [ ] Microservices architecture
- [ ] Message queue (RabbitMQ/Kafka)
- [ ] CDN integration
- [ ] Multi-region deployment
- [ ] Blockchain for audit trail
- [ ] AR/VR visualization

---

## Total Package Count

- **Frontend**: 15 npm packages
- **Backend**: 15 pip packages
- **AI System**: 8 pip packages
- **Total**: 38 dependencies

---

## Documentation

- **README.md** - Project overview
- **PROJECT_WORKFLOW.md** - Complete workflow
- **TECH_STACK.md** - This file
- **RENDER_DEPLOYMENT.md** - Deployment guide
- **QUICK_DEPLOY.md** - Quick start guide
- **crime_ai_system.py/README.md** - AI system docs

---

**Last Updated**: March 2026
**Version**: 1.0
**Maintained By**: LokSuraksha Team
