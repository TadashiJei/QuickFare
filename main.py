# main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List
import uvicorn
import jwt
from datetime import datetime, timedelta
from cryptography.fernet import Fernet
import asyncio
import aioredis

app = FastAPI()

# Redis for real-time updates
redis = aioredis.from_url("redis://localhost", encoding="utf-8", decode_responses=True)

# Secret key for JWT
SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"

# Secret key for NFC card encryption
CARD_ENCRYPTION_KEY = Fernet.generate_key()
fernet = Fernet(CARD_ENCRYPTION_KEY)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class User(BaseModel):
    username: str
    card_id: str

class Transaction(BaseModel):
    card_id: str
    amount: float
    timestamp: datetime

# In-memory database (replace with actual database in production)
users_db = {}
transactions_db = []

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return username

@app.post("/register")
async def register_user(user: User):
    if user.username in users_db:
        raise HTTPException(status_code=400, detail="Username already registered")
    encrypted_card_id = fernet.encrypt(user.card_id.encode())
    users_db[user.username] = {"card_id": encrypted_card_id, "balance": 0}
    return {"message": "User registered successfully"}

@app.post("/token")
async def login(username: str):
    if username not in users_db:
        raise HTTPException(status_code=400, detail="Incorrect username")
    access_token = create_access_token(data={"sub": username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/balance")
async def check_balance(current_user: str = Depends(get_current_user)):
    user_data = users_db.get(current_user)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"balance": user_data["balance"]}

@app.post("/reload")
async def reload_balance(amount: float, current_user: str = Depends(get_current_user)):
    user_data = users_db.get(current_user)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    user_data["balance"] += amount
    transaction = Transaction(card_id=current_user, amount=amount, timestamp=datetime.now())
    transactions_db.append(transaction)
    await redis.publish("balance_updates", f"{current_user}:{user_data['balance']}")
    return {"message": "Balance reloaded successfully", "new_balance": user_data["balance"]}

@app.post("/pay")
async def make_payment(amount: float, current_user: str = Depends(get_current_user)):
    user_data = users_db.get(current_user)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    if user_data["balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    user_data["balance"] -= amount
    transaction = Transaction(card_id=current_user, amount=-amount, timestamp=datetime.now())
    transactions_db.append(transaction)
    await redis.publish("balance_updates", f"{current_user}:{user_data['balance']}")
    return {"message": "Payment successful", "new_balance": user_data["balance"]}

@app.get("/history")
async def get_history(current_user: str = Depends(get_current_user)):
    user_transactions = [t for t in transactions_db if fernet.decrypt(t.card_id).decode() == current_user]
    return user_transactions

from nfc_operations import NFCReader

nfc_reader = NFCReader()

@app.post("/nfc/read")
async def read_nfc_card():
    card_data = nfc_reader.read_card()
    if card_data:
        return {"card_data": card_data}
    raise HTTPException(status_code=400, detail="Failed to read NFC card")

@app.post("/nfc/write")
async def write_nfc_card(data: str):
    if nfc_reader.write_card(data):
        return {"message": "Data written successfully"}
    raise HTTPException(status_code=400, detail="Failed to write to NFC card")

from fastapi import WebSocket

@app.websocket("/ws/balance")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await redis.subscribe("balance_updates")
            if data:
                await websocket.send_json({"balance": float(data.split(":")[1])})
    except WebSocketDisconnect:
        print("WebSocket disconnected")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

    