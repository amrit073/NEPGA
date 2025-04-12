from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
import uvicorn
from typing import Optional, List
import uuid
from datetime import datetime, timedelta
import jwt
from sqlalchemy import create_engine, Column, String, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Create FastAPI app
app = FastAPI(title="Nepal Passport E-Governance Application (NPEGA)")

# Mount the static files directory to serve CSS, JS, images, etc.
app.mount("/static", StaticFiles(directory="public/static"), name="static")

# Set up templates
templates = Jinja2Templates(directory="public")

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./passport_applications.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# JWT settings
SECRET_KEY = "your-secret-key-for-jwt"  # Change this in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/admin/login")

# Admin credentials (in a real app, store these securely in a database)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"  # Change this in production!

# Database model
class PassportApplicationDB(Base):
    __tablename__ = "passport_applications"
    
    application_id = Column(String, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    address = Column(Text, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=False)
    citizenship_number = Column(String, nullable=False)
    emergency_contact = Column(String, nullable=True)
    passport_type = Column(String, nullable=False)
    additional_notes = Column(Text, nullable=True)
    submission_date = Column(DateTime, default=datetime.now)
    status = Column(String, default="Pending")

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models for API
class PassportApplication(BaseModel):
    full_name: str
    date_of_birth: str
    gender: str
    address: str
    phone: str
    email: str
    citizenship_number: str
    emergency_contact: Optional[str] = None
    passport_type: str = "Ordinary"
    additional_notes: Optional[str] = None

class PassportResponse(BaseModel):
    application_id: str
    submission_date: str
    status: str = "Pending"

class AdminLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    token: str
    token_type: str = "bearer"

class StatusUpdate(BaseModel):
    status: str

# Authentication functions
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None or username != ADMIN_USERNAME:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    return username

# API routes
@app.post("/api/passport", response_model=PassportResponse)
async def submit_passport_application(application: PassportApplication, db: Session = Depends(get_db)):
    """API endpoint to submit passport application"""
    # Generate a unique ID for the application
    application_id = str(uuid.uuid4())
    
    # Create a new database record
    db_application = PassportApplicationDB(
        application_id=application_id,
        full_name=application.full_name,
        date_of_birth=application.date_of_birth,
        gender=application.gender,
        address=application.address,
        phone=application.phone,
        email=application.email,
        citizenship_number=application.citizenship_number,
        emergency_contact=application.emergency_contact,
        passport_type=application.passport_type,
        additional_notes=application.additional_notes,
        submission_date=datetime.now(),
        status="Pending"
    )
    
    # Add to database
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    
    # Return the application ID and status
    return PassportResponse(
        application_id=application_id,
        submission_date=db_application.submission_date.isoformat(),
        status=db_application.status
    )

@app.get("/api/passport/{application_id}")
async def get_application_status(application_id: str, db: Session = Depends(get_db)):
    """API endpoint to check application status"""
    # Query the database for the application
    application = db.query(PassportApplicationDB).filter(PassportApplicationDB.application_id == application_id).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {
        "application_id": application.application_id,
        "submission_date": application.submission_date.isoformat(),
        "status": application.status
    }

@app.post("/api/admin/login", response_model=Token)
async def admin_login(form_data: AdminLogin):
    """API endpoint for admin login"""
    if form_data.username != ADMIN_USERNAME or form_data.password != ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    
    return {"token": access_token}

@app.get("/api/admin/applications")
async def get_applications(
    page: int = 1, 
    limit: int = 10, 
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    """API endpoint to get all applications (paginated)"""
    # Calculate offset
    offset = (page - 1) * limit
    
    # Get total count
    total = db.query(PassportApplicationDB).count()
    
    # Get applications for current page
    applications = db.query(PassportApplicationDB).order_by(
        PassportApplicationDB.submission_date.desc()
    ).offset(offset).limit(limit).all()
    
    # Convert to dict
    applications_list = []
    for app in applications:
        applications_list.append({
            "application_id": app.application_id,
            "full_name": app.full_name,
            "submission_date": app.submission_date.isoformat(),
            "passport_type": app.passport_type,
            "status": app.status
        })
    
    return {
        "applications": applications_list,
        "total": total,
        "page": page,
        "limit": limit
    }

@app.get("/api/admin/applications/{application_id}")
async def get_application_details(
    application_id: str, 
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    """API endpoint to get application details"""
    application = db.query(PassportApplicationDB).filter(PassportApplicationDB.application_id == application_id).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {
        "application_id": application.application_id,
        "full_name": application.full_name,
        "date_of_birth": application.date_of_birth,
        "gender": application.gender,
        "address": application.address,
        "phone": application.phone,
        "email": application.email,
        "citizenship_number": application.citizenship_number,
        "emergency_contact": application.emergency_contact,
        "passport_type": application.passport_type,
        "additional_notes": application.additional_notes,
        "submission_date": application.submission_date.isoformat(),
        "status": application.status
    }

@app.put("/api/admin/applications/{application_id}/status")
async def update_application_status(
    application_id: str, 
    status_update: StatusUpdate,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    """API endpoint to update application status"""
    # Validate status
    valid_statuses = ["Pending", "Processing", "Approved", "Rejected"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    # Get application
    application = db.query(PassportApplicationDB).filter(PassportApplicationDB.application_id == application_id).first()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update status
    application.status = status_update.status
    db.commit()
    
    return {"message": "Status updated successfully"}

# HTML routes
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the index.html file from the public directory"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/{page_path:path}", response_class=HTMLResponse)
async def read_page(request: Request, page_path: str):
    """Serve any page from the public directory"""
    # Skip API routes
    if page_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
        
    # If the path doesn't have an extension, assume it's an HTML page
    if "." not in page_path:
        page_path = f"{page_path}.html"
    
    try:
        return templates.TemplateResponse(page_path, {"request": request})
    except Exception as e:
        # Print the error for debugging
        print(f"Error serving template {page_path}: {e}")
        # If the template doesn't exist, return a 404 response
        return HTMLResponse(content=f"Page not found: {page_path}", status_code=404)

# For direct execution
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
