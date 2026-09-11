import asyncio
import json
import websockets

async def main():
    uri = 'ws://127.0.0.1:8000/api/v1/ws/voice-analysis/test-ws-1'
    async with websockets.connect(uri, origin='http://localhost:3000') as ws:
        await ws.send(json.dumps({'type': 'session.start', 'session_id': 'test-ws-1', 'identity_id': None}))
        msg = await ws.recv()
        print('first_message', msg)

if __name__ == '__main__':
    asyncio.run(main())
