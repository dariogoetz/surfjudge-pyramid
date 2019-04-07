import os
import asyncio
import websockets
import uuid

import json

import threading

import logging
log = logging.getLogger(__name__)

class WebSocketManager():
    def __init__(self, host, port, loop):
        self.host = host
        self.port = port
        self.channels = {}
        self.connections = {}
        self.loop = loop
        log.info('Generating websockets server on %s:%s', self.host, self.port)

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

                # no response messages for now
                # await self.send_socket_async(socket_id, response)
        except websockets.exceptions.ConnectionClosed:
            pass
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
        """Dispatches messages to various methods depending on the JSON-message field "action".
        Currently "subscribe" actions is available.
        """
        action = message.get('action')
        if action is None:
            log.warning('No "action" provided in received message.')
            return

        # for now only "subscribe" action is allowed
        if action == 'subscribe':
            channel = message.get('channel')
            if channel is not None:
                self.subscribe(socket_id, channel)

        # no broadcasting allowed for now
        #elif action == 'broadcast':
        #    channel = message.get('channel')
        #    msg = message.get('message')
        #    if channel is not None:
        #        await self.send_channel(channel, msg)
        return

    async def send_socket_async(self, socket_id, message):
        """Send a message to a websocket with given id."""
        websocket = self.connections.get(socket_id)
        if websocket is None:
            log.warning('Could not send message: No connection found for %s', socket_id)
            return

        # log.info('Sending message to %s: %s', socket_id, message)
        await websocket.send(message)

    async def send_channel_async(self, channel, message):
        """Send a message to all websockets subscribed to a given channel"""
        log.info('Sending message to channel "%s": %s', channel, message)
        msg = json.dumps({'channel': channel, 'message': message})
        for socket_id in self.channels.get(channel, set()):
            await self.send_socket_async(socket_id, msg)

    def subscribe(self, socket_id, channel):
        """Subscribe a websocket with given socket_id to a channel."""
        self.channels.setdefault(channel, set()).add(socket_id)

    def send_channel(self, channel, message):
        asyncio.run_coroutine_threadsafe(self.send_channel_async(channel, message), self.loop)


def includeme(config):
    """Add websockets to request object. A separate thread is started hosting an asyncio event loop
    and the websockets server."""

    settings = config.get_settings()
    host = os.environ.get('WEBSOCKETS_HOST')
    if host is None:
        host = settings.get('websockets.host', '0.0.0.0')
    port = os.environ.get('WEBSOCKETS_PORT')
    if port is None:
        port = settings.get('websockets.port', '6544')

    # generate a new event loop for the websocket thread (to not block the main thread's event loop)
    loop = asyncio.new_event_loop()

    manager = WebSocketManager(host, port, loop)
    config.add_request_method(lambda r: manager, 'websockets', reify=True)

    log.info('Starting thread for websocket')
    # set up function for adding a new loop to the thread and run it
    def start_websocket_worker(loop, websocket_manager):
        asyncio.set_event_loop(loop)
        loop.run_until_complete(websockets.serve(manager, manager.host, manager.port))
        loop.run_forever()

    # start a thread for running the new loop
    worker = threading.Thread(target=start_websocket_worker,
                              args=(loop, manager),
                              name='WebsocketThread',
                              daemon=True)
    worker.start()


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    manager = WebSocketManager('0.0.0.0', 6544)
    log.info('Starting websocket server')
    asyncio.get_event_loop().run_until_complete(websockets.serve(manager, manager.host, manager.port))
    asyncio.get_event_loop().run_forever()
