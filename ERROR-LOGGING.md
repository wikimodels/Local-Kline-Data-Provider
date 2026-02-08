# Error Logging System

## Overview

Added comprehensive error logging system for tracking Bybit API errors with detailed information saved to `logs/error-logs.txt`.

## Files Created

### `core/utils/error-logger.ts`

Utility module for logging detailed error information to file, including:
- Full error messages and stack traces
- HTTP response status codes
- Complete API response bodies
- Timestamps and context information

## Files Modified

### `core/getters/get-kline.ts`

Added detailed error logging for Bybit Kline API:
- Logs HTTP errors with full response text
- Logs invalid response structures with complete JSON body
- Saves all error details to `logs/error-logs.txt`

### `core/getters/get-bybit-oi.ts`

Added detailed error logging for Bybit OI API:
- Logs HTTP errors with full response text
- Logs invalid response structures with complete JSON body
- Saves all error details to `logs/error-logs.txt`

## Log File Format

Each error entry in `logs/error-logs.txt` includes:

```
================================================================================
[2026-02-08T17:03:42.123Z] BYBIT API ERROR
Symbol: BTCUSDT
URL: https://api.bybit.com/v5/market/kline?...
HTTP Status: 200
Response Body:
{
  "retCode": 10001,
  "retMsg": "Invalid symbol",
  "result": null
}
================================================================================
```

## Usage

The error logging happens automatically when Bybit API returns:
1. Non-200 HTTP status codes
2. Invalid response structure (missing `result.list`)

All errors are logged to both:
- Console (existing logger)
- File (`logs/error-logs.txt`)

## Benefits

- **Debugging**: Full API responses help identify why requests fail
- **Monitoring**: Track patterns in API errors over time
- **Troubleshooting**: Complete context for each error
