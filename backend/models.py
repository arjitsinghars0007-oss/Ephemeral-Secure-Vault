from sqlalchemy import Column, String, Integer, DateTime
from database import Base
import datetime
import uuid

class FileMetadata(Base):
    __tablename__ = "files"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String, index=True)
    storage_path = Column(String, unique=True)
    expires_at = Column(DateTime)
    views_allowed = Column(Integer, default=1)



    