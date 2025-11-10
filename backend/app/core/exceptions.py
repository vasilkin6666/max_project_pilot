# backend/app/core/exceptions.py
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

class UnauthorizedException(HTTPException):
    def __init__(self, detail="Could not validate credentials"):
        logger.warning(f"Unauthorized access attempt: {detail}")
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )

class ForbiddenException(HTTPException):
    def __init__(self, detail="Access denied"):
        logger.warning(f"Forbidden access: {detail}")
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )

class NotFoundException(HTTPException):
    def __init__(self, detail="Item not found"):
        logger.info(f"Resource not found: {detail}")
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )

class BadRequestException(HTTPException):
    def __init__(self, detail="Bad request"):
        logger.info(f"Bad request: {detail}")
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

class ValidationException(HTTPException):
    def __init__(self, detail="Validation error"):
        logger.info(f"Validation error: {detail}")
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )

class ConflictException(HTTPException):
    def __init__(self, detail="Resource conflict"):
        logger.warning(f"Resource conflict: {detail}")
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )
