# Crime Heatmap Flask Application

This project is a Flask-based web application that allows users to report crimes in real-time and visualize these reports on a heatmap. The application features a user-friendly interface for submitting reports, including the ability to upload photos, and displays the data dynamically with varying colors based on crime levels.

## Features

- **Real-time Crime Reporting**: Users can submit crime reports that are instantly reflected on the heatmap.
- **Heatmap Visualization**: Crime reports are displayed on a heatmap, with colors indicating the severity or frequency of crimes in different areas.
- **Photo Uploads**: Users can upload images related to their reports for better context.
- **Responsive Design**: The application is designed to work on various devices, ensuring accessibility for all users.

## Project Structure

```
crime-heatmap-flask
├── app
│   ├── __init__.py
│   ├── config.py
│   ├── extensions.py
│   ├── models.py
│   ├── schemas.py
│   ├── api
│   │   ├── __init__.py
│   │   └── reports.py
│   ├── services
│   │   └── socket_service.py
│   ├── templates
│   │   ├── index.html
│   │   └── report_form.html
│   └── static
│       ├── js
│       │   ├── map.js
│       │   └── realtime.js
│       └── css
│           └── style.css
├── uploads
├── migrations
├── tests
│   └── test_reports.py
├── .env.example
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/crime-heatmap-flask.git
   cd crime-heatmap-flask
   ```

2. Create a virtual environment and activate it:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. Install the required packages:
   ```
   pip install -r requirements.txt
   ```

4. Set up the environment variables by copying `.env.example` to `.env` and updating the values as needed.

5. Run the application (Socket.IO real-time mode):
   ```
   python app.py
   ```

## Usage

- Navigate to `http://localhost:5000` in your web browser to access the application.
- Use the report form to submit new crime reports.
- The heatmap will update in real-time as new reports are submitted.

## OTP (Real SMS)

Set these environment variables to enable real-time SMS OTP delivery via Twilio:

- `REQUIRE_REPORT_OTP=true`
- `OTP_PROVIDER=twilio`
- `OTP_DEV_MODE=false`
- `TWILIO_ACCOUNT_SID=...`
- `TWILIO_AUTH_TOKEN=...`
- `TWILIO_FROM_NUMBER=...`

For local testing without SMS provider:

- `OTP_PROVIDER=console`
- `OTP_DEV_MODE=true`

## FIR Verification (HyperVerge)

Set these environment variables to enable FIR verification via HyperVerge API:

- `HYPERVERGE_FIR_VERIFY_URL=...`
- `HYPERVERGE_APP_ID=...`
- `HYPERVERGE_APP_KEY=...`
- `HYPERVERGE_BEARER_TOKEN=...` (optional)
- `HYPERVERGE_HTTP_METHOD=POST` (or `GET`)
- `HYPERVERGE_TIMEOUT_SECONDS=20`

## Testing

To run the tests, use the following command:
```
pytest tests/test_reports.py
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
