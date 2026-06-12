@echo off
set DEBUG=False
"C:\Users\Gautam\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000
