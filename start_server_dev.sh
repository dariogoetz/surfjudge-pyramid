export PYTHONPATH=app
export WEBSOCKET_URL=ws://localhost:6544

env/bin/pserve app/development.ini --reload
