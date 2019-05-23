import sys
import os

import zmq
import zmq.asyncio

import logging
log = logging.getLogger(__name__)

class ZeroMQSubscriber():
    """ZeroMQ server for subscribing to multiple publishers. Binds a port."""
    def __init__(self, port, websocket_manager):
        self.port = port
        self.websocket_manager = websocket_manager

        self._context = zmq.asyncio.Context()
        self._socket = self._context.socket(zmq.SUB)
        self._socket.bind('tcp://*:%s' % self.port)
        self._socket.setsockopt(zmq.SUBSCRIBE, b'')

    async def receive(self):
        while True:
            msg = await self._socket.recv_json()
            log.debug('Received message for channel "%s": "%s"', msg['channel'], msg['message'])
            await self.websocket_manager.send_channel_async(msg['channel'], msg['message'])



class ZeroMQPublisher():
    """ZeroMQ server for publishing to a subscriber. Connects to a port."""
    def __init__(self, port):
        self.port = port

        self._context = zmq.Context()
        self._socket = self._context.socket(zmq.PUB)
        self._socket.connect("tcp://localhost:%s" % self.port)
        log.info('Generating zeromq client on port %s', self.port)

    def send_channel(self, channel, message):
        msg = {'channel': channel, 'message': message}
        log.debug('Sending zeromq message to channel "%s": "%s"', channel, message)
        self._socket.send_json(msg, flags=zmq.NOBLOCK)




def includeme(config):
    """Add zeromq server to request object."""
    settings = config.get_settings()
    port = os.environ.get('ZEROMQ_PORT')
    if port is None:
        port = settings.get('zeromq.port', '6545')
    log.warning('Using zeromq websocket realization. MAKE SURE, THAT A ZEROMQ-WEBSOCKET SERVER IS RUNNING ON PORT %s', port)

    log.info('Starting zeromq publishing client')
    manager = ZeroMQPublisher(port)
    config.add_request_method(lambda r: manager, 'websockets', reify=True)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Test zeromq publisher client")
    parser.add_argument('--port', default=6545, type=int, help='Port of the zeromq server.')

    args = parser.parse_args()
    import time
    logging.basicConfig(level=logging.INFO)

    manager = ZeroMQPublisher(args.port)
    log.info('Starting zeromq publisher server, connecting to port %s', args.port)
    while True:
        log.info('Sending test message')
        manager.send_channel("test", "hello world")
        time.sleep(1)

