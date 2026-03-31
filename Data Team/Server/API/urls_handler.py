from django.urls import path
from . import views_handler

urlpatterns = [
    path("users/", views_handler.create_user, name="create_user"),
    path("users/<str:user_id>/", views_handler.mutate_user, name="mutate_user"),
    path("schools/", views_handler.create_school, name="create_school"),
    path("schools/<str:school_id>/", views_handler.mutate_school, name="mutate_school"),
]
