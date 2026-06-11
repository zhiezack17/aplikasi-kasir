from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict


# ============ Setup ============
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_HOURS = 24

app = FastAPI(title="Cafe POS API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ============ Helpers ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi telah berakhir")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang diizinkan")
    return user


# ============ Models ============
class LoginRequest(BaseModel):
    username: str
    password: str

class UserPublic(BaseModel):
    id: str
    username: str
    name: str
    role: str

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    price: float
    stock: int = 0
    category_id: str
    image_url: Optional[str] = ""
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    stock: int = 0
    category_id: str
    image_url: Optional[str] = ""
    active: bool = True

class TransactionItem(BaseModel):
    product_id: str
    product_name: str
    price: float
    quantity: int
    subtotal: float

class TransactionCreate(BaseModel):
    items: List[TransactionItem]
    payment_method: Literal["cash", "transfer", "qris"]
    cash_received: Optional[float] = None
    notes: Optional[str] = ""

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    items: List[TransactionItem]
    subtotal: float
    tax: float
    total: float
    payment_method: str
    cash_received: Optional[float] = None
    change: Optional[float] = None
    notes: Optional[str] = ""
    cashier_id: str
    cashier_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _strip_mongo(doc: dict) -> dict:
    doc.pop("_id", None)
    if isinstance(doc.get("created_at"), str):
        try:
            doc["created_at"] = datetime.fromisoformat(doc["created_at"])
        except Exception:
            pass
    return doc


# ============ Auth Endpoints ============
@api_router.post("/auth/login")
async def login(payload: LoginRequest, response: Response):
    username = payload.username.strip().lower()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token(user["id"], user["username"], user["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False,
        samesite="lax", max_age=ACCESS_TOKEN_HOURS * 3600, path="/"
    )
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "name": user["name"], "role": user["role"]},
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logout berhasil"}

@api_router.get("/auth/me", response_model=UserPublic)
async def get_me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)


# ============ Categories ============
@api_router.get("/categories")
async def list_categories(_user: dict = Depends(get_current_user)):
    cats = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    for c in cats:
        _strip_mongo(c)
    return cats

@api_router.post("/categories")
async def create_category(payload: CategoryCreate, _admin: dict = Depends(require_admin)):
    cat = Category(**payload.model_dump())
    doc = cat.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.categories.insert_one(doc)
    return cat.model_dump()

@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryCreate, _admin: dict = Depends(require_admin)):
    res = await db.categories.update_one({"id": cat_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return cat

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _admin: dict = Depends(require_admin)):
    # Check if any product uses this category
    in_use = await db.products.count_documents({"category_id": cat_id})
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"Tidak dapat menghapus: {in_use} produk masih menggunakan kategori ini")
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    return {"message": "Kategori dihapus"}


# ============ Products ============
@api_router.get("/products")
async def list_products(_user: dict = Depends(get_current_user)):
    products = await db.products.find({}, {"_id": 0}).sort("name", 1).to_list(2000)
    return products

@api_router.post("/products")
async def create_product(payload: ProductCreate, _admin: dict = Depends(require_admin)):
    cat = await db.categories.find_one({"id": payload.category_id})
    if not cat:
        raise HTTPException(status_code=400, detail="Kategori tidak valid")
    p = Product(**payload.model_dump())
    doc = p.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.products.insert_one(doc)
    return p.model_dump()

@api_router.put("/products/{prod_id}")
async def update_product(prod_id: str, payload: ProductCreate, _admin: dict = Depends(require_admin)):
    res = await db.products.update_one({"id": prod_id}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    p = await db.products.find_one({"id": prod_id}, {"_id": 0})
    return p

@api_router.delete("/products/{prod_id}")
async def delete_product(prod_id: str, _admin: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": prod_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"message": "Produk dihapus"}


# ============ Transactions ============
TAX_RATE = 0.10  # 10% PPN

async def _generate_order_number() -> str:
    now = datetime.now(timezone.utc)
    prefix = now.strftime("ORD%Y%m%d")
    count = await db.transactions.count_documents({
        "order_number": {"$regex": f"^{prefix}"}
    })
    return f"{prefix}-{count + 1:04d}"

@api_router.post("/transactions")
async def create_transaction(payload: TransactionCreate, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")

    # Recompute subtotals from server for safety
    items_clean = []
    subtotal = 0.0
    for it in payload.items:
        prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not prod:
            raise HTTPException(status_code=400, detail=f"Produk tidak ditemukan: {it.product_name}")
        if it.quantity <= 0:
            raise HTTPException(status_code=400, detail="Jumlah harus > 0")
        line = round(float(prod["price"]) * it.quantity, 2)
        items_clean.append(TransactionItem(
            product_id=prod["id"],
            product_name=prod["name"],
            price=float(prod["price"]),
            quantity=it.quantity,
            subtotal=line,
        ))
        subtotal += line

    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + tax, 2)
    change = None
    if payload.payment_method == "cash":
        if payload.cash_received is None or payload.cash_received < total:
            raise HTTPException(status_code=400, detail="Uang tunai kurang dari total")
        change = round(payload.cash_received - total, 2)

    order_number = await _generate_order_number()
    tx = Transaction(
        order_number=order_number,
        items=items_clean,
        subtotal=round(subtotal, 2),
        tax=tax,
        total=total,
        payment_method=payload.payment_method,
        cash_received=payload.cash_received,
        change=change,
        notes=payload.notes or "",
        cashier_id=user["id"],
        cashier_name=user["name"],
    )
    doc = tx.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    # Convert nested items (already dicts via model_dump)
    await db.transactions.insert_one(doc)

    # Decrement stock (best-effort)
    for it in items_clean:
        await db.products.update_one(
            {"id": it.product_id, "stock": {"$gte": it.quantity}},
            {"$inc": {"stock": -it.quantity}}
        )
    return tx.model_dump()

@api_router.get("/transactions")
async def list_transactions(
    user: dict = Depends(get_current_user),
    limit: int = 100,
    date: Optional[str] = None,
):
    query = {}
    if user.get("role") != "admin":
        query["cashier_id"] = user["id"]
    if date:
        # date format: YYYY-MM-DD
        query["created_at"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59.999"}
    txs = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return txs

@api_router.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str, user: dict = Depends(get_current_user)):
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    if user.get("role") != "admin" and tx.get("cashier_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    return tx


# ============ Reports ============
@api_router.get("/reports/daily")
async def daily_report(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Return today's sales summary. Admin sees all, cashier sees own."""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    query = {"created_at": {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59.999"}}
    if user.get("role") != "admin":
        query["cashier_id"] = user["id"]

    txs = await db.transactions.find(query, {"_id": 0}).to_list(5000)
    total_revenue = sum(t.get("total", 0) for t in txs)
    total_orders = len(txs)
    by_payment = {"cash": 0, "transfer": 0, "qris": 0}
    product_sales = {}
    for t in txs:
        pm = t.get("payment_method", "cash")
        by_payment[pm] = by_payment.get(pm, 0) + t.get("total", 0)
        for it in t.get("items", []):
            key = it["product_id"]
            if key not in product_sales:
                product_sales[key] = {"product_id": key, "name": it["product_name"], "quantity": 0, "revenue": 0.0}
            product_sales[key]["quantity"] += it["quantity"]
            product_sales[key]["revenue"] += it["subtotal"]
    top_products = sorted(product_sales.values(), key=lambda x: x["quantity"], reverse=True)[:5]

    # Last 7 days trend (admin only or own)
    trend = []
    today_dt = datetime.fromisoformat(date)
    for i in range(6, -1, -1):
        d = (today_dt - timedelta(days=i)).strftime("%Y-%m-%d")
        q = {"created_at": {"$gte": f"{d}T00:00:00", "$lt": f"{d}T23:59:59.999"}}
        if user.get("role") != "admin":
            q["cashier_id"] = user["id"]
        day_txs = await db.transactions.find(q, {"total": 1, "_id": 0}).to_list(5000)
        trend.append({"date": d, "revenue": sum(t.get("total", 0) for t in day_txs), "orders": len(day_txs)})

    return {
        "date": date,
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "by_payment": by_payment,
        "top_products": top_products,
        "trend": trend,
    }


# ============ Startup: seed admin + categories + products ============
SAMPLE_CATEGORIES = [
    {"name": "Kopi", "icon": "Coffee"},
    {"name": "Non-Kopi", "icon": "GlassWater"},
    {"name": "Pastry", "icon": "Croissant"},
    {"name": "Makanan", "icon": "UtensilsCrossed"},
]

SAMPLE_PRODUCTS = [
    {"name": "Espresso", "category": "Kopi", "price": 25000, "stock": 100,
     "description": "Single shot espresso",
     "image_url": "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=600"},
    {"name": "Cappuccino", "category": "Kopi", "price": 32000, "stock": 100,
     "description": "Espresso + milk foam",
     "image_url": "https://images.unsplash.com/photo-1559001724-fbad036dbc9e?w=600"},
    {"name": "Latte", "category": "Kopi", "price": 35000, "stock": 100,
     "description": "Espresso with steamed milk",
     "image_url": "https://images.unsplash.com/photo-1593443320739-77f74939d0da?w=600"},
    {"name": "Americano", "category": "Kopi", "price": 28000, "stock": 100,
     "description": "Espresso with hot water",
     "image_url": "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600"},
    {"name": "Matcha Latte", "category": "Non-Kopi", "price": 38000, "stock": 80,
     "description": "Premium matcha + milk",
     "image_url": "https://images.unsplash.com/photo-1536013455804-3c75a4d4f99a?w=600"},
    {"name": "Chocolate", "category": "Non-Kopi", "price": 30000, "stock": 80,
     "description": "Rich hot chocolate",
     "image_url": "https://images.unsplash.com/photo-1542990253-0b8be0a09b76?w=600"},
    {"name": "Croissant", "category": "Pastry", "price": 22000, "stock": 30,
     "description": "Butter croissant",
     "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600"},
    {"name": "Pain au Chocolat", "category": "Pastry", "price": 25000, "stock": 30,
     "description": "Chocolate-filled pastry",
     "image_url": "https://images.unsplash.com/photo-1623334044303-241021148842?w=600"},
    {"name": "Nasi Goreng", "category": "Makanan", "price": 45000, "stock": 25,
     "description": "Indonesian fried rice",
     "image_url": "https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=600"},
    {"name": "Mie Goreng", "category": "Makanan", "price": 40000, "stock": 25,
     "description": "Fried noodles",
     "image_url": "https://images.unsplash.com/photo-1607330289024-1535c6b4e1c1?w=600"},
]


async def seed_data():
    # Indexes
    await db.users.create_index("username", unique=True)
    await db.transactions.create_index([("created_at", -1)])
    await db.products.create_index("category_id")

    # Seed admin
    admin_username = os.environ.get("ADMIN_USERNAME", "admin").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"username": admin_username})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": admin_username,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {admin_username}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"username": admin_username},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

    # Seed cashier
    cashier_username = os.environ.get("CASHIER_USERNAME", "kasir").lower()
    cashier_password = os.environ.get("CASHIER_PASSWORD", "kasir123")
    existing_c = await db.users.find_one({"username": cashier_username})
    if not existing_c:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "username": cashier_username,
            "password_hash": hash_password(cashier_password),
            "name": "Kasir",
            "role": "cashier",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded cashier user: {cashier_username}")
    elif not verify_password(cashier_password, existing_c["password_hash"]):
        await db.users.update_one(
            {"username": cashier_username},
            {"$set": {"password_hash": hash_password(cashier_password)}}
        )

    # Seed categories if empty
    cat_count = await db.categories.count_documents({})
    cat_id_by_name = {}
    if cat_count == 0:
        for c in SAMPLE_CATEGORIES:
            cat = Category(name=c["name"], icon=c["icon"])
            doc = cat.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.categories.insert_one(doc)
            cat_id_by_name[c["name"]] = cat.id
        logger.info("Seeded sample categories")
    else:
        async for c in db.categories.find({}, {"_id": 0}):
            cat_id_by_name[c["name"]] = c["id"]

    # Seed products if empty
    prod_count = await db.products.count_documents({})
    if prod_count == 0:
        for p in SAMPLE_PRODUCTS:
            cid = cat_id_by_name.get(p["category"])
            if not cid:
                continue
            prod = Product(
                name=p["name"], description=p["description"], price=p["price"],
                stock=p["stock"], category_id=cid, image_url=p["image_url"],
            )
            doc = prod.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.products.insert_one(doc)
        logger.info("Seeded sample products")


@app.on_event("startup")
async def on_startup():
    await seed_data()


# ============ App config ============
@api_router.get("/")
async def root():
    return {"message": "Cafe POS API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
