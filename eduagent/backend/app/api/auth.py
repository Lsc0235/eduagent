"""
用户认证 API — 注册 / 登录（后端数据库存储，支持多设备）
"""
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import get_db, User

router = APIRouter()


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """注册新用户"""
    email = req.email.strip().lower()
    name = req.name.strip()

    if not name:
        raise HTTPException(400, "请输入昵称")
    if not email or "@" not in email:
        raise HTTPException(400, "请输入有效邮箱")
    if len(req.password) < 6:
        raise HTTPException(400, "密码至少 6 位")

    # 检查邮箱是否已注册
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "该邮箱已注册，请直接登录")

    user = User(
        name=name,
        email=email,
        password_hash=_hash_password(req.password),
    )
    db.add(user)
    await db.commit()

    return {"success": True, "user": {"name": name, "email": email}}


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    email = req.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(400, "账号不存在，请先注册")
    if user.password_hash != _hash_password(req.password):
        raise HTTPException(400, "密码不正确")

    return {"success": True, "user": {"name": user.name, "email": user.email}}


@router.get("/{email}")
async def get_user(email: str, db: AsyncSession = Depends(get_db)):
    """获取用户信息"""
    result = await db.execute(select(User).where(User.email == email.strip().lower()))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "用户不存在")
    return {"name": user.name, "email": user.email}
