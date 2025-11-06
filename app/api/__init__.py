from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["api"])

@router.get("/")
async def api_root():
    return {"message": "MAX Project Pilot API", "version": "1.0.0"}
