"""
Met à jour le numéro de version des fichiers CSS/JS dans index.html (…/ui.js?v=XXXX).

GitHub Pages laisse les navigateurs garder les fichiers en cache 10 minutes : sans ce numéro,
un appareil peut charger la nouvelle page avec d'anciens scripts (ex. un bouton qui ne fait rien).
À lancer avant chaque envoi sur GitHub :  python outils/version.py
"""
import os
import re
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(ROOT, "index.html")
version = time.strftime("%Y%m%d%H%M")

with open(path, encoding="utf-8") as f:
    html = f.read()

# ajoute ou remplace ?v=… sur les fichiers locaux css/… et js/…
html, n = re.subn(r'((?:href|src)="(?:css|js)/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"', rf'\1?v={version}"', html)

with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(html)
print(f"index.html : {n} fichiers en version {version}")
