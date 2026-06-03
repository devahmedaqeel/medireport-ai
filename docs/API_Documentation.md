# API Documentation

Base URL: `http://127.0.0.1:8000`

## POST /api/reports/scan
Uploads image/PDF and returns OCR text.

## POST /api/reports/parse
Parses OCR text into structured tests.

## POST /api/reports/analyze
Detects normal/low/high values.

## POST /api/reports/explain
Returns English and Roman Urdu safe explanation.

## POST /api/reports/save
Saves report to local JSON database/Firebase replacement.

## GET /api/reports/history/{userId}
Returns saved report history.

## POST /api/feedback/correction
Stores user correction for admin validation.
