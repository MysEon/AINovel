"""
Key Encryption Service — 基于 Fernet 的 API Key 加密/解密

使用 PBKDF2-HMAC-SHA256 从主密钥派生 32 字节 key，再经 base64url
编码后供 Fernet 使用。
"""

import base64
from typing import Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.core.config import get_settings


class KeyEncryptionService:
    """API Key 加密服务（Factory 单例模式）"""

    _instance: Optional["KeyEncryptionService"] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, key_material: str | None = None):
        if self._initialized:
            return
        settings = get_settings()

        # 优先使用独立 ENCRYPTION_KEY，否则回退到 AUTH_SECRET_KEY
        material = key_material or settings.encryption.encryption_key or settings.auth.secret_key
        if not material:
            raise RuntimeError("缺少加密密钥：请设置 ENCRYPTION_KEY 或 AUTH_SECRET_KEY")

        iterations = settings.encryption.pbkdf2_iterations
        self._fernet = self._derive_fernet(material, iterations)
        self._initialized = True

    @staticmethod
    def _derive_fernet(key_material: str, iterations: int) -> Fernet:
        """从 key_material 派生 Fernet 实例"""
        # 使用固定 salt（基于 key_material 的哈希）保证同一 key_material 始终生成同一 key
        salt = hashes.Hash(hashes.SHA256())
        salt.update(key_material.encode("utf-8"))
        salt_bytes = salt.finalize()[:16]

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt_bytes,
            iterations=iterations,
        )
        key = base64.urlsafe_b64encode(kdf.derive(key_material.encode("utf-8")))
        return Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """加密明文，返回 Fernet token 字符串"""
        if plaintext == "":
            return ""
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")

    def decrypt(self, ciphertext: str) -> str:
        """解密密文，返回明文；失败抛 InvalidToken"""
        if ciphertext == "":
            return ""
        return self._fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")

    def rotate_key(self, old_ciphertext: str, new_key_material: str) -> str:
        """解密旧密文并用新密钥重新加密"""
        plaintext = self.decrypt(old_ciphertext)
        settings = get_settings()
        new_fernet = self._derive_fernet(new_key_material, settings.encryption.pbkdf2_iterations)
        return new_fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def get_encryption_service() -> KeyEncryptionService:
    """获取 KeyEncryptionService 单例（用于 FastAPI Depends）"""
    return KeyEncryptionService()
