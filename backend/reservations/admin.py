from django.contrib import admin
from .models import Ong, Utilisateur, Salle, Reservation


class UtilisateurAdmin(admin.ModelAdmin):
    list_display = ['email', 'ong', 'role', 'is_active']
    fields = ['email', 'ong', 'role', 'is_active', 'is_staff']  # exclut 'password' du formulaire


admin.site.register(Ong)
admin.site.register(Utilisateur, UtilisateurAdmin)
admin.site.register(Salle)
admin.site.register(Reservation)