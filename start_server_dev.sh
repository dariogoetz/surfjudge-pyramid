echo "Starting development server"
export PYTHONPATH=.
if [ -z "$1" ]
then
    echo "No hostname for websockets specified. Trying 'hostname -I'"
    export host_ip=$(hostname -I)
    if [ -z "$host_ip" ]
    then
        echo "Found no IP! Using 'localhost'"
        export host_ip=localhost
    else
        echo "Found IP '$host_ip'"
    fi
else
    export host_ip=$1
fi
export WEBSOCKET_URL="ws://${host_ip}:6544"
echo "Using websocket url $WEBSOCKET_URL"
cd app && ../env/bin/pserve development.ini --reload
