"""KeyEncryptionService 单元测试"""

import os
import pytest

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_SECRET_KEY", "test-secret-key-must-be-at-least-32-chars-long!!")

from app.infrastructure.secrets.key_encryption_service import KeyEncryptionService


@pytest.fixture(autouse=True)
def reset_singleton():
    """每个用例前重置单例"""
    KeyEncryptionService._instance = None
    yield
    KeyEncryptionService._instance = None


class TestKeyEncryptionService:
    def test_encrypt_decrypt_roundtrip(self):
        svc = KeyEncryptionService("test-key-material-for-fernet-service")
        plaintext = "sk-my-api-key-12345"
        ciphertext = svc.encrypt(plaintext)
        decrypted = svc.decrypt(ciphertext)
        assert decrypted == plaintext
        assert ciphertext.startswith("gAAA")

    def test_decrypt_with_wrong_key_fails(self):
        svc1 = KeyEncryptionService("key-one-for-testing-purposes-only!!")
        ciphertext = svc1.encrypt("secret-data")

        KeyEncryptionService._instance = None
        svc2 = KeyEncryptionService("key-two-for-testing-purposes-only!!")
        with pytest.raises(Exception):
            svc2.decrypt(ciphertext)

    def test_rotate_key(self):
        svc = KeyEncryptionService("original-key-material-for-testing")
        plaintext = "api-key-to-rotate"
        old_ciphertext = svc.encrypt(plaintext)

        rotated = svc.rotate_key(old_ciphertext, "new-key-material-for-testing")
        assert rotated != old_ciphertext
        assert rotated.startswith("gAAA")

        # 用新 key 派生解密（rotate_key 内部用新 key 加密）
        KeyEncryptionService._instance = None
        svc_new = KeyEncryptionService("new-key-material-for-testing")
        assert svc_new.decrypt(rotated) == plaintext

    def test_empty_string(self):
        svc = KeyEncryptionService("test-key-material-for-fernet-service")
        assert svc.encrypt("") == ""
        assert svc.decrypt("") == ""

    def test_large_string(self):
        svc = KeyEncryptionService("test-key-material-for-fernet-service")
        big = "x" * (1024 * 1024 + 1)  # > 1MB
        ciphertext = svc.encrypt(big)
        decrypted = svc.decrypt(ciphertext)
        assert decrypted == big
