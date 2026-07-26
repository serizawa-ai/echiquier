#!/usr/bin/env python3
"""Sert le dossier de l'app sur http://127.0.0.1:8000.

On fixe la racine explicitement (au lieu de `python3 -m http.server`) parce que
le processus peut démarrer dans un répertoire courant inaccessible, ce qui fait
échouer l'appel à os.getcwd() du module.
"""
import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

handler = functools.partial(SimpleHTTPRequestHandler, directory=ROOT)
ThreadingHTTPServer.allow_reuse_address = True
server = ThreadingHTTPServer(("127.0.0.1", 8000), handler)
print("Serving %s on http://127.0.0.1:8000" % ROOT, flush=True)
server.serve_forever()
