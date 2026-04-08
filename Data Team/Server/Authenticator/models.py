from django.db import models

# Create your models here.
class User(models.Model):
    UID = models.CharField(max_length=150, unique=True)
    token = models.CharField(max_length=255)

    def __str__(self):
        return f"User ID: {self.UID}\nToken: {self.token}"