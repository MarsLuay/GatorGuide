from django.urls import path
from . import views

urlpatterns = [
    path('generate/', views.token_generator, name='token_generator'),
]
