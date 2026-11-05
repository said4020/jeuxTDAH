"""
Tester le jeu sur smartphone : lance un petit serveur web sur le PC et affiche un QR code à scanner.

Utilisation (depuis le dossier du projet) :
    python outils/tester-sur-mobile.py            (port 8080 par défaut)
    python outils/tester-sur-mobile.py 8000       (autre port)

Le téléphone doit être connecté au MÊME réseau que le PC (même box / même Wi-Fi).
Au premier lancement, Windows peut demander d'autoriser Python dans le pare-feu : accepter pour
les « réseaux privés ». Ctrl+C pour arrêter le serveur.
"""
import functools
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


def local_ips():
    """Adresse principale (celle de la route par défaut) puis les autres adresses IPv4 privées."""
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # aucun paquet envoyé : sert juste à choisir l'interface
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except OSError:
        pass
    return ips or ["127.0.0.1"]


def qr_page(url, others):
    """Page HTML locale avec le QR code en SVG (aucune ressource externe)."""
    import qrcode
    import qrcode.image.svg

    img = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=12, border=2)
    svg = img.to_string(encoding="unicode")
    alt = "".join(f"<li><code>http://{ip}:{PORT}/</code></li>" for ip in others)
    alt_block = f"<p>Si ça ne marche pas, essaie une autre adresse du PC :</p><ul>{alt}</ul>" if alt else ""
    return f"""<!doctype html><html lang="fr"><meta charset="utf-8"><title>QR code · test mobile</title>
<style>
  body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#04121f;color:#e9f6ff;font-family:system-ui,sans-serif}}
  .card{{background:#0a1b2e;border:1px solid rgba(160,220,255,.2);border-radius:20px;padding:28px;max-width:420px;text-align:center}}
  .qr{{background:#fff;border-radius:12px;padding:10px;display:inline-block}} .qr svg{{width:300px;height:300px;display:block}}
  code{{color:#40f0d6;font-size:18px}} p,li{{color:#b8cfe0;line-height:1.5}} ul{{text-align:left}}
</style>
<div class="card">
  <h1>Scanne avec ton téléphone</h1>
  <div class="qr">{svg}</div>
  <p><code>{url}</code></p>
  <p>Le téléphone doit être sur le même réseau que ce PC.<br>Tiens-le à l'horizontale pour jouer.</p>
  {alt_block}
</div></html>"""


def main():
    ips = local_ips()
    url = f"http://{ips[0]}:{PORT}/"

    try:
        import qrcode  # noqa: F401
    except ImportError:
        print("Il manque le module qrcode :  python -m pip install --user qrcode")
        sys.exit(1)

    qr_file = os.path.join(ROOT, "outils", "qr-mobile.html")
    with open(qr_file, "w", encoding="utf-8") as f:
        f.write(qr_page(url, ips[1:]))

    import qrcode
    q = qrcode.QRCode(border=1)
    q.add_data(url)
    print("\n  Abysse : test sur smartphone")
    print(f"  Adresse : {url}\n")
    try:
        q.print_ascii(invert=True)
    except UnicodeEncodeError:
        pass  # console sans UTF-8 : la page HTML suffit
    print("\n  Le QR code s'ouvre aussi dans le navigateur. Ctrl+C pour arrêter.\n")
    webbrowser.open(f"http://127.0.0.1:{PORT}/outils/qr-mobile.html")

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("0.0.0.0", PORT), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Serveur arrêté.")


if __name__ == "__main__":
    main()
