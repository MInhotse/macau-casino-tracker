import struct, zlib

def make_chunk(tag, data):
    c = tag + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

def create_icon(size, gold):
    gr, gg, gb = gold
    # IHDR
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    raw = b''
    for y in range(size):
        raw += b'\x00'
        for x in range(size):
            cx = cy = size // 2
            dist = ((x-cx)**2 + (y-cy)**2) ** 0.5
            outer = size // 2 - 4
            inner = outer - 24
            if dist < inner:
                raw += bytes([gr, gg, gb, 255])
            elif dist < outer:
                a = int(255 * (1 - (dist - inner) / 24))
                raw += bytes([gr, gg, gb, a])
            else:
                raw += bytes([0, 0, 0, 0])
    idat = zlib.compress(raw)
    return b'\x89PNG\r\n\x1a\n' + make_chunk(b'IHDR', ihdr) + make_chunk(b'IDAT', idat) + make_chunk(b'IEND', b'')

gold = (212, 175, 55)
with open(r'c:\Users\admin.DESKTOP-L2K21NT\WorkBuddy\20260409100629\icon-512.png', 'wb') as f:
    f.write(create_icon(512, gold))
with open(r'c:\Users\admin.DESKTOP-L2K21NT\WorkBuddy\20260409100629\icon-192.png', 'wb') as f:
    f.write(create_icon(192, gold))
print("Done")
