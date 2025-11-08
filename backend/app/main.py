from fastapi import FastAPI
from . import api

app = FastAPI(title="MAX Pilot API")

@app.get("/")
async def root():
    return {"message": "MAX Pilot v4.0 — PostgreSQL Ready!"}
