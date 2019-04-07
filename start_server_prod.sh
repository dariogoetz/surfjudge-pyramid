export PYTHONPATH=.
export WEBSOCKET_URL=ws://localhost:6544
cd app && sudo ../env/bin/gunicorn --paste production.ini