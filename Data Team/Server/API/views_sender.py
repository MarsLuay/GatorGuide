# You may change these libraries depending on your use
from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
from .serializer import UserSerializer
from .models import User
# Create your views here.

# Write your bunch of GET function here
@api_view(['GET'])
def get_users(request):
    return Response(UserSerializer(User.objects.all(), many=True).data)

# @api_view(['GET'])
# def get_user(request, pk):
#     try:
#         user = User.objects.get(pk = pk)
#     except User.DoesNotExist:
#         return Response(status=status.HTTP_404_NOT_FOUND)

#     serializer = UserSerializer(user)
#     return Response(serializer.data, status=status.HTTP_200_OK)

# @api_view(['GET'])
# def get_school(request, pk):
#     try:
#         school = School.objects.get(pk = pk)
#     except School.DoesNotExist:
#         return Response(status=status.HTTP_404_NOT_FOUND)

#     serializer = SchoolSerializer(school)
#     return Response(serializer.data, status=status.HTTP_200_OK)

# @api_view(['GET'])
# def get_all_school(request):
#     schools = School.objects.values('name','school_id')
#     return Response(list(schools), status=status.HTTP_200_OK)