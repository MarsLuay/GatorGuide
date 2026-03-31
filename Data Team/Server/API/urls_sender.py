from django.urls import path
from . import views_sender

urlpatterns = [
    path("users/", views_sender.get_users, name="get_users"),
    path("users/<str:user_id>/", views_sender.get_user, name="get_user"),
    path("schools/", views_sender.get_schools, name="get_schools"),
    path("schools/<str:school_id>/", views_sender.get_school, name="get_school"),
]
