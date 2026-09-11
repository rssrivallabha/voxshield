import asyncio
import json
import websockets

async def main():
    uri = 'ws://127.0.0.1:8000/api/v1/ws/voice-analysis/test123'
    try:
        async with websockets.connect(uri, origin='http://localhost:3000') as ws:
            await ws.send(json.dumps({'type': 'session.start', 'session_id': 'test123', 'identity_id': None}))
            msg = await ws.recv()
            print('recv', msg)
    except Exception as e:
        print('err', type(e).__name__, e)

if __name__ == '__main__':
    asyncio.run(main())
