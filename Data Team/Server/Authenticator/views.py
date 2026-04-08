from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from django.core.signing import TimestampSigner, SignatureExpired, BadSignature
from django.conf import settings
from cryptography.fernet import Fernet
from .models import User
from API.models import User as APIUser

# Load encryption key from settings
if getattr(settings, 'ENCRYPTION_KEY', None):
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode('utf-8'))
else:
    # Fallback to prevent crash during migrations if .env isn't loaded yet
    cipher_suite = None

# Create your views here.

@api_view(['POST'])
def token_generator(request):
    uid = request.data.get('uid')
    if not uid:
        return Response({"message": "UID is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # The current API app still uses `user_id`; the donor UID rename migration is not active here yet.
    if not APIUser.objects.filter(user_id=uid).exists():
        return Response({"message": "UID does not exist in the system"}, status=status.HTTP_404_NOT_FOUND)
        
    # Check if user already has an active token that isn't expired
    existing_user = User.objects.filter(UID=uid).first()
    signer = TimestampSigner()
    
    if existing_user and existing_user.token:
        try:
            # Check if current token is still valid (600 seconds = 10 minutes)
            signer.unsign(existing_user.token, max_age=600)
            return Response(
                {"message": "A valid token already exists for this UID. Please wait for it to expire."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        except (SignatureExpired, BadSignature):
            # Token is expired or invalid, we can proceed to generate a new one
            pass
            
    if not cipher_suite:
        return Response({"message": "Server encryption not configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Generate timestamp-signed token with encrypted UID
    encrypted_uid = cipher_suite.encrypt(uid.encode('utf-8')).decode('utf-8')
    token = signer.sign(encrypted_uid)
    
    user, _created = User.objects.update_or_create(
        UID=uid,
        defaults={'token': token}
    )
    
    return Response({"message": "Token Generated Successfully", "data": user.token}, status=status.HTTP_201_CREATED)
