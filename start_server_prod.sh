export PYTHONPATH=.
then
    echo "No hostname for websockets specified. Trying 'hostname -I'."
    export host_ip=$(hostname -I)
else
    export host_ip=$1
fi
export WEBSOCKET_URL="ws://${host_ip}:6544"
echo "Using websocket url $WEBSOCKET_URL"
cd app && sudo ../env/bin/gunicorn --paste production.ini
