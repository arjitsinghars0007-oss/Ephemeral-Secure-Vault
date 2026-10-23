from sqlalchemy import Column, String, Integer, DateTime
from database import Base
import os

class FileMetadata(Base):
    __tablename__ = "files"

    id = Column(String, primary_key=True, default=lambda: os.urandom(16).hex())
    original_filename = Column(String, nullable=False, index=True)
    storage_path = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    encryption_key_hint = Column(String, nullable=True)  # placeholder, not used for storing keys
    views_allowed = Column(Integer, default=1, nullable=False)
