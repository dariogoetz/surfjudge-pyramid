export PYTHONPATH=app
export WEBSOCKET_URL=ws://localhost:6544
sudo env/bin/gunicorn --paste app/production.ini