"""
Génère le QR code du site en ligne (GitHub Pages) :
  - outils/qr-site.png  : image à imprimer ou à envoyer par message
  - outils/qr-site.html : page à afficher à l'écran pour scanner

Utilisation : python outils/qr-site.py [adresse]
"""
import os
import sys
import webbrowser

import qrcode
import qrcode.image.svg

URL = sys.argv[1] if len(sys.argv) > 1 else "https://said4020.github.io/jeuxTDAH/"
HERE = os.path.dirname(os.path.abspath(__file__))

# Image PNG (niveau de correction M : reste lisible même imprimée petite)
q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=3)
q.add_data(URL)
q.make(fit=True)
q.make_image(fill_color="#04121f", back_color="white").save(os.path.join(HERE, "qr-site.png"))

# Page HTML à afficher sur l'écran du PC
svg = qrcode.make(URL, image_factory=qrcode.image.svg.SvgPathImage, box_size=12, border=2).to_string(encoding="unicode")
html = f"""<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Abysse · QR code</title>
<style>
  body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#04121f;color:#e9f6ff;font-family:system-ui,sans-serif;padding:16px;box-sizing:border-box}}
  .card{{background:#0a1b2e;border:1px solid rgba(160,220,255,.2);border-radius:20px;padding:28px;max-width:440px;text-align:center}}
  h1{{margin:0 0 4px;letter-spacing:.2em}} .sub{{margin:0 0 18px;color:#40f0d6;font-size:13px;letter-spacing:.2em;text-transform:uppercase}}
  .qr{{background:#fff;border-radius:14px;padding:12px;display:inline-block}} .qr svg{{width:min(320px,70vw);height:auto;display:block}}
  a{{color:#40f0d6;font-size:17px;word-break:break-all}} ol{{text-align:left;color:#b8cfe0;line-height:1.6;padding-left:20px}}
</style>
<div class="card">
  <h1>ABYSSE</h1><p class="sub">Entraînement de l'attention</p>
  <div class="qr">{svg}</div>
  <p><a href="{URL}">{URL}</a></p>
  <ol>
    <li>Ouvre l'appareil photo du téléphone ou de la tablette et vise le QR code.</li>
    <li>Touche le lien qui apparaît.</li>
    <li>Tiens l'appareil à l'horizontale pour jouer.</li>
    <li>Astuce : « Ajouter à l'écran d'accueil » pour le retrouver comme une appli.</li>
  </ol>
</div></html>"""
with open(os.path.join(HERE, "qr-site.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("QR code :", URL)
print(" -", os.path.join(HERE, "qr-site.png"))
print(" -", os.path.join(HERE, "qr-site.html"))
webbrowser.open("file:///" + os.path.join(HERE, "qr-site.html").replace("\\", "/"))
