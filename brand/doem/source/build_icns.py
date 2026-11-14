from pathlib import Path
import struct
root = Path(__file__).resolve().parent.parent
chunks = []
for code, size in [('icp4',16),('icp5',32),('icp6',64),('ic07',128),('ic08',256),('ic09',512),('ic10',1024),('ic11',32),('ic12',64),('ic13',256),('ic14',512)]:
    data = (root / 'png' / f'doem-app-{size}.png').read_bytes()
    chunks.append(code.encode() + struct.pack('>I',len(data)+8) + data)
body = b''.join(chunks)
(root / 'macos/Doem.icns').write_bytes(b'icns'+struct.pack('>I',len(body)+8)+body)
