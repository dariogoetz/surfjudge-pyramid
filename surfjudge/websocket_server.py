import asyncio
import websockets
import uuid

import json

import logging
log = logging.getLogger(__name__)

class WebSocketManager():
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.channels = {}
        self.connections = {}
        log.info('Starting websockets server on %s:%s', self.host, self.port)


    async def __call__(self, websocket, path):
        """Opens a websocket connection and listens to messages. Each opened websocket is stored in self.connections.
        Incoming messages will be dispatched by the self.dispatch method.
        """
        socket_id = str(uuid.uuid4())
        log.info('Opening websocket connection for %s', socket_id)
        self.connections.setdefault(socket_id, websocket)
        try:
            # event loop for all incoming messages from this websocket
            while True:
                message_str = await websocket.recv()
                # decode json message
                try:
                    log.info('Received message from %s: %s', socket_id, message_str)
                    message = json.loads(message_str)
                except:
                    log.warning('Could not decode message from %s: "%s"', socket_id, message_str)
                    continue
                # consume message
                response = await self.dispatcher(socket_id, message)
                await self.send_socket(socket_id, response)
        except:
            log.warning('Error in websocket connection to %s', socket_id)
        finally:
            self.forget_websocket(socket_id)

    def forget_websocket(self, socket_id):
        """Removes a websocket from self.connections and all channels in self.channels.
        """
        log.info('Closing websocket for %s', socket_id)
        if socket_id in self.connections:
            del self.connections[socket_id]
        for channel in self.channels:
            self.channels[channel].discard(socket_id)

    async def dispatcher(self, socket_id, message):
        res = json.dumps({})
        action = message.get('action')
        if action is None:
            log.warning('No "action" provided in received message.')
            return res

        if action == 'subscribe':
            channel = message.get('channel')
            if channel is not None:
                self.subscribe(socket_id, channel)
                res = json.dumps(list(self.channels.get(channel)))

        elif action == 'broadcast':
            channel = message.get('channel')
            msg = message.get('message')
            if channel is not None:
                await self.send_channel(channel, msg)
        return res

    async def send_socket(self, socket_id, message):
        websocket = self.connections.get(socket_id)
        if websocket is None:
            log.warning('Could not send message: No connection found for %s', socket_id)
            return

        log.info('Sending message to %s: %s', socket_id, message)
        await websocket.send(message)

    async def send_channel(self, channel, message):
        for socket_id in self.channels.get(channel, set()):
            log.info('Sending message to %s: %s', socket_id, message)
            await self.send_socket(socket_id, message)

    def subscribe(self, socket_id, channel):
        self.channels.setdefault(channel, set()).add(socket_id)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    manager = WebSocketManager('localhost', 6544)
    asyncio.get_event_loop().run_until_complete(websockets.serve(manager, manager.host, manager.port))
    asyncio.get_event_loop().run_forever()
