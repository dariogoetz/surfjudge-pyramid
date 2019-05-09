export PYTHONPATH=.
export host_ip=$(hostname -I)
export WEBSOCKET_URL="ws://${host_ip}:6544"
cd app && ../env/bin/pserve development.ini --reload
