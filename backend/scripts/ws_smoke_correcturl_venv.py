import asyncio
import websockets

async def main():
    uri = 'ws://127.0.0.1:8000/ws/v1/voice-analysis/test123'
    async with websockets.connect(uri, origin='http://localhost:3000') as ws:
        print('connected')

if __name__ == '__main__':
    asyncio.run(main())
