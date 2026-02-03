from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Tuple

from cryptography.fernet import Fernet, InvalidToken


@dataclass
class SavedLinkedInCredentials:
    username: str
    password: str


class LinkedInCredentialsStore:
    def __init__(self, firestore_service):
        self.firestore_service = firestore_service
        self._fernet = self._build_fernet()

    @staticmethod
    def _build_fernet() -> Optional[Fernet]:
        key = os.getenv("LINKEDIN_CREDENTIALS_KEY")
        if not key:
            return None
        if isinstance(key, str):
            key_bytes = key.encode("utf-8")
        else:
            key_bytes = key
        return Fernet(key_bytes)

    def has_saved_credentials(self, user_email: str) -> Tuple[bool, Optional[str]]:
        settings = self.firestore_service.get_user_settings(user_email) or {}
        creds = settings.get("linkedin_credentials") or {}
        username = creds.get("username")
        password_enc = creds.get("password_encrypted")
        return bool(username and password_enc), username

    def get_saved_credentials(self, user_email: str) -> Optional[SavedLinkedInCredentials]:
        settings = self.firestore_service.get_user_settings(user_email) or {}
        creds = settings.get("linkedin_credentials") or {}
        username = creds.get("username")
        password_enc = creds.get("password_encrypted")
        if not username or not password_enc:
            return None
        if not self._fernet:
            raise RuntimeError("LINKEDIN_CREDENTIALS_KEY is not configured")
        try:
            password = self._fernet.decrypt(password_enc.encode("utf-8")).decode("utf-8")
        except InvalidToken as exc:
            raise RuntimeError("Failed to decrypt stored LinkedIn credentials") from exc
        return SavedLinkedInCredentials(username=username, password=password)

    def save_credentials(self, user_email: str, username: str, password: str) -> None:
        if not self._fernet:
            raise RuntimeError("LINKEDIN_CREDENTIALS_KEY is not configured")
        password_enc = self._fernet.encrypt(password.encode("utf-8")).decode("utf-8")
        self.firestore_service.set_user_settings(
            user_email,
            {
                "linkedin_credentials": {
                    "username": username,
                    "password_encrypted": password_enc,
                }
            },
        )
