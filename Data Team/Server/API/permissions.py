from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken
from Authenticator.models import User as AuthUser

# Load encryption key from settings safely
if getattr(settings, 'ENCRYPTION_KEY', None):
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode('utf-8'))
else:
    cipher_suite = None

class IsValidToken(BasePermission):
    """
    Custom permission class to check if a valid token is provided in the headers
    and verifies its expiration dynamically via encryption decryption.
    """
    message = {"message": "Authorization token is missing, invalid, or expired"}

    def has_permission(self, request, view):
        auth_token = request.headers.get('Authorization')

        if not auth_token:
            raise PermissionDenied(detail=self.message)

        signer = TimestampSigner()
        
        if not cipher_suite:
            raise PermissionDenied(detail={"message": "Server encryption not configured properly"})
            
        try:
            # Unsign the token checking max_age (limit to 10 minutes / 600 seconds)
            encrypted_uid = signer.unsign(auth_token, max_age=600)
            
            # Decrypt the string to get the real UID
            uid = cipher_suite.decrypt(encrypted_uid.encode('utf-8')).decode('utf-8')
            
            # Verify token exists in database and matches
            if not AuthUser.objects.filter(UID=uid, token=auth_token).exists():
                raise PermissionDenied(detail=self.message)
                
            return True
            
        except (BadSignature, SignatureExpired, InvalidToken):
            # Includes InvalidToken when the decryption fails (e.g. old non-encrypted token)
            raise PermissionDenied(detail=self.message)
