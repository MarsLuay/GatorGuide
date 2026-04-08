import logging

from rest_framework import status
from rest_framework.response import Response

from .models import User
from .serializer import UserSerializer

logger = logging.getLogger(__name__)


def create_user(serializer: UserSerializer, user_id: str):
    if User.objects.filter(user_id=user_id).exists():
        return Response({"errors": "User Already Exists"}, status=status.HTTP_400_BAD_REQUEST)

    if serializer.is_valid():
        try:
            serializer.save(user_id=user_id)
        except Exception:
            logger.exception("Failed to create user profile for user_id=%s", user_id)
            return Response(
                {"errors": "Profile Created Failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"message": "Profile Created Successfully", "data": serializer.data},
            status=status.HTTP_201_CREATED,
        )

    return Response(
        {"errors": "Profile Created Failed", "details": serializer.errors},
        status=status.HTTP_400_BAD_REQUEST,
    )


def update_user(user_id: str, data):
    try:
        user = User.objects.get(user_id=user_id)
    except User.DoesNotExist:
        return Response({"errors": "User Not Found"}, status=status.HTTP_404_NOT_FOUND)

    serializer = UserSerializer(user, data=data, partial=True)
    try:
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Profile Updated Successfully", "data": serializer.data},
                status=status.HTTP_200_OK,
            )
        return Response(
            {"errors": "Profile Updated Failed", "details": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        logger.exception("Failed to update user profile for user_id=%s", user_id)
        return Response(
            {"errors": "Update Failed"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def delete_user(user_id: str):
    try:
        deleted_count, _ = User.objects.filter(user_id=user_id).delete()
        if deleted_count == 0:
            return Response({"errors": "User Not Found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": "Profile Deleted Successfully"}, status=status.HTTP_200_OK)
    except Exception:
        logger.exception("Failed to delete user profile for user_id=%s", user_id)
        return Response(
            {"errors": "Delete Failed"},
            status=status.HTTP_400_BAD_REQUEST,
        )
