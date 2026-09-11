import asyncio
import json
import websockets

async def main():
    uri = 'ws://127.0.0.1:8000/ws/v1/voice-analysis/test123'
    try:
        async with websockets.connect(uri, origin='http://localhost:3000') as ws:
            await ws.send(json.dumps({'type': 'session.start', 'session_id': 'test123', 'identity_id': None}))
            msg = await ws.recv()
            print(msg)
    except Exception as e:
        print('ERR', type(e).__name__, e)

asyncio.run(main())
