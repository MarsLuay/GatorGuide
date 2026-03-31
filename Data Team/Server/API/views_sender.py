from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import School, User
from .serializer import SchoolSerializer, UserSerializer


@api_view(["GET"])
def get_users(request):
    queryset = User.objects.select_related("transcript", "preference").order_by("user_id")
    return Response(UserSerializer(queryset, many=True).data)


@api_view(["GET"])
def get_user(request, user_id):
    user = get_object_or_404(User.objects.select_related("transcript", "preference"), user_id=user_id)
    return Response(UserSerializer(user).data)


@api_view(["GET"])
def get_schools(request):
    queryset = School.objects.select_related("cost_of_attendance").order_by("name")

    query = request.query_params.get("q", "").strip()
    state = request.query_params.get("state", "").strip()
    school_type = request.query_params.get("school_type", "").strip()
    climate = request.query_params.get("climate", "").strip()

    if query:
        queryset = queryset.filter(
            Q(name__icontains=query)
            | Q(city__icontains=query)
            | Q(state__icontains=query)
            | Q(school_id__icontains=query)
        )
    if state:
        queryset = queryset.filter(state__iexact=state)
    if school_type:
        queryset = queryset.filter(school_type__iexact=school_type)
    if climate:
        queryset = queryset.filter(climate__icontains=climate)

    return Response(SchoolSerializer(queryset, many=True).data)


@api_view(["GET"])
def get_school(request, school_id):
    school = get_object_or_404(School.objects.select_related("cost_of_attendance"), school_id=school_id)
    return Response(SchoolSerializer(school).data)
