export PYTHONPATH=.
export WEBSOCKET_URL=ws://localhost:6544

cd app && ../env/bin/pserve development.ini --reload
